//! Pure retention policy — the decision half of the snapshot engine.
//!
//! **No filesystem access lives in this file**, and no clock is read inside it: `now` is
//! always a parameter so every decision is a deterministic function of its inputs. That is
//! what makes the tiered retention rules table-testable, and what lets a future consumer
//! (a different storage backend, a WASM tier) reuse the policy unchanged.
//!
//! The two decisions here are:
//!
//! - [`should_snapshot`] — *do we take one at all?* (deduplication + minimum interval)
//! - [`plan_retention`] — *which of the ones we have do we keep?* (tiers + storage budget)

use std::borrow::Cow;
use std::collections::{HashMap, HashSet};

use chrono::{DateTime, Datelike, Duration, Months, Utc};
use serde::{Deserialize, Serialize};

// ── Retention constants (plan Assumption 1) ───────────────────────────────────────────
//
// Deliberately fixed in this version rather than user-configurable, and deliberately
// gathered here so a later TODO can expose them without restructuring anything.

/// Snapshots kept purely because they are the newest, regardless of age.
pub const RECENT_SNAPSHOTS: usize = 10;
/// Days over which one snapshot per calendar day is kept.
pub const DAILY_DAYS: i64 = 14;
/// Weeks over which one snapshot per ISO week is kept.
pub const WEEKLY_WEEKS: u32 = 8;
/// Months over which one snapshot per calendar month is kept.
pub const MONTHLY_MONTHS: u32 = 12;
/// Minimum gap between two *automatic* snapshots.
pub const MIN_AUTOMATIC_INTERVAL_SECS: i64 = 60 * 60;
/// Storage floor: the budget is never smaller than this, however small the journal is.
pub const MIN_STORAGE_BUDGET_BYTES: u64 = 2 * 1024 * 1024 * 1024;
/// Storage budget as a multiple of the live journal's size, when that exceeds the floor.
pub const STORAGE_BUDGET_JOURNAL_MULTIPLE: u64 = 3;

// ── Trigger ───────────────────────────────────────────────────────────────────────────

/// Why a snapshot was taken.
///
/// `Destructive` carries a `Cow<'static, str>` rather than a bare `&'static str` so the
/// variant both constructs allocation-free from a literal (`SnapshotTrigger::destructive`)
/// *and* round-trips through the JSON manifest, which needs an owned string on the way back.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SnapshotTrigger {
    /// Taken after a successful unlock.
    Unlock,
    /// Taken as the journal is locked, if it changed while unlocked.
    Lock,
    /// Taken *before* a schema migration runs. Never skipped, never allowed to fail silently.
    Migration,
    /// Taken before a named destructive operation (journal reset, import, slot removal…).
    Destructive(Cow<'static, str>),
    /// Explicitly requested by the user.
    Manual,
    /// Safety snapshot taken immediately before a restore.
    PreRestore,
    /// A pre-upgrade file adopted from disk. The engine that wrote it recorded no trigger
    /// and had several, so this says what is actually known rather than inventing one.
    Adopted,
}

impl SnapshotTrigger {
    /// Allocation-free constructor for the compile-time-known operation names.
    pub const fn destructive(operation: &'static str) -> Self {
        SnapshotTrigger::Destructive(Cow::Borrowed(operation))
    }

    /// Whether this trigger ignores the deduplication and minimum-interval rules.
    ///
    /// The bypassing triggers are the ones that precede an irreversible write or were
    /// explicitly asked for. Skipping one of those to save a few megabytes is exactly the
    /// trade the incident this engine exists to prevent got wrong.
    pub fn bypasses_rate_limits(&self) -> bool {
        matches!(
            self,
            SnapshotTrigger::Migration
                | SnapshotTrigger::Destructive(_)
                | SnapshotTrigger::Manual
                | SnapshotTrigger::PreRestore
        )
    }
}

// ── Snapshot metadata ─────────────────────────────────────────────────────────────────

/// Everything known about one snapshot without opening it.
///
/// This is also the manifest's per-snapshot record (see `manifest.rs`). Its contents are
/// governed by the plan's **Privacy Decision**: timestamps, counts, sizes, versions, and
/// auth-slot *types* only. No entry content, no titles, no tag names, no journal name, no
/// user-chosen slot labels, and no filesystem path — `file_name` is a generated
/// `backup-…​.db` stamp, which contains no user-chosen text and is the only way to tie a
/// record to its file.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SnapshotMeta {
    /// Generated file name (not a path) inside the backups directory.
    pub file_name: String,
    pub created_at: DateTime<Utc>,
    pub trigger: SnapshotTrigger,
    pub byte_size: u64,
    /// SQLite file-header change counter of the **source** database at snapshot time.
    ///
    /// `None` for adopted pre-upgrade files, which forces the next decision to take a
    /// snapshot rather than assume nothing changed.
    pub sqlite_change_counter: Option<u32>,
    pub db_schema_version: Option<i32>,
    pub app_version: Option<String>,
    pub entry_count: Option<i64>,
    /// `(earliest, latest)` `YYYY-MM-DD` entry dates present in the snapshot.
    pub entry_date_range: Option<(String, String)>,
    /// Auth-slot **types** (`password`, `keypair`, `auto`) — never labels, which are
    /// user-chosen text.
    pub auth_slot_types: Vec<String>,
    /// Whether the live master key was confirmed to decrypt this snapshot's content.
    ///
    /// `false` means "not confirmed", **not** "unknown contents": everything else in this
    /// record is readable from a locked snapshot without a key.
    pub verified: bool,
}

// ── Policy ────────────────────────────────────────────────────────────────────────────

/// The tier windows, interval, and storage budget that drive both decisions.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RetentionPolicy {
    pub recent: usize,
    pub daily_days: i64,
    pub weekly_weeks: u32,
    pub monthly_months: u32,
    pub min_interval: Duration,
    pub storage_budget_bytes: u64,
}

impl RetentionPolicy {
    /// The shipped policy, with the storage budget scaled to the live journal.
    ///
    /// `max(2 GB, 3 × journal size)` — the floor keeps small journals from being thinned
    /// aggressively, the multiple keeps large ones from being capped at a single copy.
    pub fn for_journal_size(journal_size_bytes: u64) -> Self {
        Self {
            storage_budget_bytes: MIN_STORAGE_BUDGET_BYTES
                .max(journal_size_bytes.saturating_mul(STORAGE_BUDGET_JOURNAL_MULTIPLE)),
            ..Self::default()
        }
    }
}

impl Default for RetentionPolicy {
    fn default() -> Self {
        Self {
            recent: RECENT_SNAPSHOTS,
            daily_days: DAILY_DAYS,
            weekly_weeks: WEEKLY_WEEKS,
            monthly_months: MONTHLY_MONTHS,
            min_interval: Duration::seconds(MIN_AUTOMATIC_INTERVAL_SECS),
            storage_budget_bytes: MIN_STORAGE_BUDGET_BYTES,
        }
    }
}

// ── Decision: take a snapshot at all? ─────────────────────────────────────────────────

/// Why an automatic snapshot was not taken.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum SkipReason {
    /// The database has not been written since the newest snapshot.
    Unchanged,
    /// The newest snapshot is younger than the minimum interval.
    TooSoon,
}

/// Outcome of [`should_snapshot`].
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SnapshotDecision {
    Take,
    Skip(SkipReason),
}

/// Decides whether a snapshot should be created.
///
/// `current_change_counter` is the live database's SQLite file-header change counter. It is
/// compared against the value **persisted in the manifest**, never against a counter read
/// back from a snapshot file: `VACUUM INTO` rebuilds the database, so the copy's counter
/// bears no relation to the source's (see `test_vacuum_into_resets_the_change_counter`).
///
/// An unknown counter on either side means "assume changed" — erring toward one redundant
/// snapshot, never toward missing one.
pub fn should_snapshot(
    snapshots: &[SnapshotMeta],
    trigger: &SnapshotTrigger,
    current_change_counter: Option<u32>,
    policy: &RetentionPolicy,
    now: DateTime<Utc>,
) -> SnapshotDecision {
    if trigger.bypasses_rate_limits() {
        return SnapshotDecision::Take;
    }

    let Some(newest) = snapshots.iter().max_by_key(|s| s.created_at) else {
        return SnapshotDecision::Take;
    };

    if let (Some(current), Some(previous)) = (current_change_counter, newest.sqlite_change_counter)
    {
        if current == previous {
            return SnapshotDecision::Skip(SkipReason::Unchanged);
        }
    }

    if now.signed_duration_since(newest.created_at) < policy.min_interval {
        return SnapshotDecision::Skip(SkipReason::TooSoon);
    }

    SnapshotDecision::Take
}

// ── Decision: which snapshots to keep? ────────────────────────────────────────────────

/// Which tier earned a snapshot its place. Ordered least to most durable — the derived
/// `Ord` is what makes "thin newest-tier-first" a plain sort.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
enum Tier {
    Recent,
    Daily,
    Weekly,
    Monthly,
}

/// The result of applying retention to a set of snapshots.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RetentionDecision {
    /// Snapshots to keep, newest first.
    pub keep: Vec<SnapshotMeta>,
    /// Snapshots to delete.
    pub evict: Vec<SnapshotMeta>,
    /// Whether the storage budget forced evictions beyond what the tiers alone required.
    pub budget_exceeded: bool,
}

/// Selects which snapshots to keep.
///
/// Tiers are assigned by *calendar bucket*, which is what makes time depth independent of
/// activity: 200 unlocks in one hour all fall in the same day, week, and month bucket, so
/// they compete for one slot in each tier instead of pushing older snapshots out. Buckets
/// are computed in **UTC** so the function stays a pure function of its inputs and does not
/// read the process time zone.
///
/// Only after tier selection is the storage budget applied, and it thins the *newest* tier
/// first — shedding fine-grained recent history rather than time depth. The single newest
/// snapshot is never evicted.
pub fn plan_retention(
    snapshots: &[SnapshotMeta],
    policy: &RetentionPolicy,
    now: DateTime<Utc>,
) -> RetentionDecision {
    let mut ordered: Vec<&SnapshotMeta> = snapshots.iter().collect();
    // Newest first; file name breaks ties so the result is deterministic for snapshots
    // sharing a timestamp.
    ordered.sort_by(|a, b| {
        b.created_at
            .cmp(&a.created_at)
            .then_with(|| b.file_name.cmp(&a.file_name))
    });

    if ordered.is_empty() {
        return RetentionDecision {
            keep: Vec::new(),
            evict: Vec::new(),
            budget_exceeded: false,
        };
    }

    let mut tier_of: HashMap<&str, Tier> = HashMap::new();

    // Recent tier: the N newest, whatever their age.
    for snapshot in ordered.iter().take(policy.recent) {
        tier_of.insert(snapshot.file_name.as_str(), Tier::Recent);
    }

    // Bucketed tiers, applied in increasing durability so the deepest tier a snapshot
    // qualifies for is the one recorded — that is what the budget's shed order reads.
    let daily_cutoff = now
        .checked_sub_signed(Duration::days(policy.daily_days))
        .unwrap_or(now);
    claim_bucket(&ordered, daily_cutoff, Tier::Daily, &mut tier_of, |s| {
        let d = s.created_at.date_naive();
        (d.year(), d.month(), d.day())
    });

    let weekly_cutoff = now
        .checked_sub_signed(Duration::weeks(policy.weekly_weeks as i64))
        .unwrap_or(now);
    claim_bucket(&ordered, weekly_cutoff, Tier::Weekly, &mut tier_of, |s| {
        let w = s.created_at.iso_week();
        (w.year(), w.week(), 0)
    });

    let monthly_cutoff = now
        .checked_sub_months(Months::new(policy.monthly_months))
        .unwrap_or(now);
    claim_bucket(&ordered, monthly_cutoff, Tier::Monthly, &mut tier_of, |s| {
        (s.created_at.year(), s.created_at.month(), 0)
    });

    // Apply the storage budget by moving the least durable, oldest kept snapshots out.
    let newest_file_name = ordered[0].file_name.as_str();
    let mut kept_total: u64 = ordered
        .iter()
        .filter(|s| tier_of.contains_key(s.file_name.as_str()))
        .map(|s| s.byte_size)
        .sum();
    let mut budget_exceeded = false;

    if kept_total > policy.storage_budget_bytes {
        budget_exceeded = true;

        let mut shed_order: Vec<&&SnapshotMeta> = ordered
            .iter()
            .filter(|s| {
                tier_of.contains_key(s.file_name.as_str()) && s.file_name != newest_file_name
            })
            .collect();
        // Least durable tier first, and **newest first within a tier**.
        //
        // Newest-first matters most once thinning is forced past the recent tier: shedding
        // the oldest member of the monthly tier would destroy exactly the time depth the
        // budget is supposed to protect. Taking the newest monthly instead costs the
        // snapshot with the closest surviving neighbour. Inside the recent tier the same
        // rule coarsens granularity near the present, which the always-retained newest
        // snapshot already covers.
        shed_order.sort_by(|a, b| {
            tier_of[a.file_name.as_str()]
                .cmp(&tier_of[b.file_name.as_str()])
                .then_with(|| b.created_at.cmp(&a.created_at))
        });

        for snapshot in shed_order {
            if kept_total <= policy.storage_budget_bytes {
                break;
            }
            tier_of.remove(snapshot.file_name.as_str());
            kept_total = kept_total.saturating_sub(snapshot.byte_size);
        }
    }

    let (keep, evict): (Vec<_>, Vec<_>) = ordered
        .into_iter()
        .cloned()
        .partition(|s| tier_of.contains_key(s.file_name.as_str()));

    RetentionDecision {
        keep,
        evict,
        budget_exceeded,
    }
}

/// Claims one snapshot per calendar bucket for `tier`, scanning newest-first so the newest
/// member of each bucket is the survivor.
fn claim_bucket<'a, F>(
    ordered: &[&'a SnapshotMeta],
    cutoff: DateTime<Utc>,
    tier: Tier,
    tier_of: &mut HashMap<&'a str, Tier>,
    bucket: F,
) where
    F: Fn(&SnapshotMeta) -> (i32, u32, u32),
{
    let mut seen: HashSet<(i32, u32, u32)> = HashSet::new();
    for snapshot in ordered {
        if snapshot.created_at < cutoff {
            continue;
        }
        if seen.insert(bucket(snapshot)) {
            tier_of.insert(snapshot.file_name.as_str(), tier);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn now() -> DateTime<Utc> {
        DateTime::parse_from_rfc3339("2026-08-04T12:00:00Z")
            .unwrap()
            .with_timezone(&Utc)
    }

    fn snapshot(name: &str, created_at: DateTime<Utc>, byte_size: u64) -> SnapshotMeta {
        SnapshotMeta {
            file_name: name.to_string(),
            created_at,
            trigger: SnapshotTrigger::Unlock,
            byte_size,
            sqlite_change_counter: Some(1),
            db_schema_version: Some(13),
            app_version: Some("0.6.4".to_string()),
            entry_count: Some(0),
            entry_date_range: None,
            auth_slot_types: vec!["password".to_string()],
            verified: true,
        }
    }

    /// `n` snapshots at a fixed spacing, newest at `now - offset`.
    fn series(count: usize, spacing: Duration, offset: Duration, size: u64) -> Vec<SnapshotMeta> {
        (0..count)
            .map(|i| {
                let created = now() - offset - spacing * (i as i32);
                snapshot(&format!("backup-{:04}.db", count - i), created, size)
            })
            .collect()
    }

    fn kept_names(decision: &RetentionDecision) -> Vec<String> {
        decision.keep.iter().map(|s| s.file_name.clone()).collect()
    }

    // ── plan_retention: table-driven tier coverage ───────────────────────────────────

    #[test]
    fn test_retention_empty_set() {
        let decision = plan_retention(&[], &RetentionPolicy::default(), now());
        assert!(decision.keep.is_empty());
        assert!(decision.evict.is_empty());
        assert!(!decision.budget_exceeded);
    }

    #[test]
    fn test_retention_single_snapshot_is_kept() {
        let snapshots = vec![snapshot("backup-a.db", now() - Duration::days(900), 10)];
        let decision = plan_retention(&snapshots, &RetentionPolicy::default(), now());
        assert_eq!(kept_names(&decision), vec!["backup-a.db"]);
        assert!(decision.evict.is_empty());
    }

    #[test]
    fn test_retention_everything_older_than_every_tier_keeps_only_the_recent_tier() {
        // 20 snapshots, all ~3 years old and each in its own month bucket. No tier window
        // reaches them, so only the `recent` tier applies.
        let snapshots = series(20, Duration::days(31), Duration::days(1000), 10);
        let decision = plan_retention(&snapshots, &RetentionPolicy::default(), now());

        assert_eq!(decision.keep.len(), RECENT_SNAPSHOTS);
        assert_eq!(decision.evict.len(), 10);
        // The survivors are the newest ones.
        let newest = decision.keep.first().unwrap().created_at;
        for evicted in &decision.evict {
            assert!(evicted.created_at < newest);
        }
    }

    #[test]
    fn test_burst_activity_cannot_evict_the_oldest_tier() {
        // The regression guard for the incident: heavy activity in a single hour must not
        // consume the time-depth tiers.
        let mut snapshots = Vec::new();

        // One snapshot per month for the last 12 months — the monthly tier.
        for month in 1..=12u32 {
            let created = now() - Months::new(month);
            snapshots.push(snapshot(
                &format!("backup-monthly-{:02}.db", month),
                created,
                10,
            ));
        }
        let oldest_monthly = snapshots.last().unwrap().file_name.clone();

        // 200 snapshots inside one hour.
        for i in 0..200 {
            snapshots.push(snapshot(
                &format!("backup-burst-{:04}.db", i),
                now() - Duration::seconds(i * 18),
                10,
            ));
        }

        let decision = plan_retention(&snapshots, &RetentionPolicy::default(), now());
        let kept = kept_names(&decision);

        assert!(
            kept.contains(&oldest_monthly),
            "a burst of 200 snapshots in one hour evicted the oldest monthly snapshot"
        );
        for month in 1..=12u32 {
            assert!(
                kept.contains(&format!("backup-monthly-{:02}.db", month)),
                "monthly snapshot {} was evicted by burst activity",
                month
            );
        }
        // The burst itself collapses to the recent tier plus its single day/week/month slot.
        let burst_kept = kept.iter().filter(|n| n.contains("burst")).count();
        assert!(
            burst_kept <= RECENT_SNAPSHOTS + 3,
            "burst kept {} snapshots, expected at most the recent tier plus one per bucket",
            burst_kept
        );
    }

    #[test]
    fn test_retention_one_per_day_for_400_days() {
        let snapshots = series(400, Duration::days(1), Duration::zero(), 10);
        let decision = plan_retention(&snapshots, &RetentionPolicy::default(), now());
        let kept = kept_names(&decision);

        // Daily tier covers 14 distinct days (which subsumes the 10 recent), the weekly
        // tier adds the remaining weeks up to 8, and the monthly tier the remaining months
        // up to 12.
        assert!(
            kept.len() >= DAILY_DAYS as usize,
            "expected at least one snapshot per day over the daily window, got {}",
            kept.len()
        );
        assert!(
            kept.len() < 60,
            "400 daily snapshots should thin to well under 60, got {}",
            kept.len()
        );
        assert_eq!(decision.keep.len() + decision.evict.len(), 400);

        // Time depth: something must survive from ~11 months back.
        let oldest_kept = decision.keep.last().unwrap().created_at;
        assert!(
            oldest_kept < now() - Duration::days(300),
            "the monthly tier did not preserve depth; oldest kept is {}",
            oldest_kept
        );
    }

    #[test]
    fn test_retention_keeps_one_snapshot_per_calendar_day_in_the_daily_window() {
        // 40 snapshots every 6 hours = 10 days, comfortably inside the 14-day daily window.
        let snapshots = series(40, Duration::hours(6), Duration::zero(), 10);
        let decision = plan_retention(&snapshots, &RetentionPolicy::default(), now());

        // The invariant that matters: no calendar day inside the window loses its last
        // snapshot, however many it started with.
        let input_days: HashSet<_> = snapshots
            .iter()
            .map(|s| s.created_at.date_naive())
            .collect();
        let kept_days: HashSet<_> = decision
            .keep
            .iter()
            .map(|s| s.created_at.date_naive())
            .collect();
        assert_eq!(
            kept_days, input_days,
            "the daily tier dropped a calendar day that was inside its window"
        );

        // And days the recent tier does not reach collapse to a single snapshot.
        let oldest_day = decision.keep.last().unwrap().created_at.date_naive();
        let kept_on_oldest_day = decision
            .keep
            .iter()
            .filter(|s| s.created_at.date_naive() == oldest_day)
            .count();
        assert_eq!(
            kept_on_oldest_day, 1,
            "a day outside the recent tier kept more than one snapshot"
        );
        assert_eq!(decision.keep.len() + decision.evict.len(), 40);
    }

    // ── plan_retention: storage budget ───────────────────────────────────────────────

    /// 12 monthly snapshots (time depth) plus 10 recent ones, 100 bytes each.
    fn deep_and_recent() -> Vec<SnapshotMeta> {
        let mut snapshots = Vec::new();
        for month in 1..=12u32 {
            snapshots.push(snapshot(
                &format!("backup-monthly-{:02}.db", month),
                now() - Months::new(month),
                100,
            ));
        }
        for i in 0..10i64 {
            snapshots.push(snapshot(
                &format!("backup-recent-{:02}.db", i),
                now() - Duration::minutes(i * 3),
                100,
            ));
        }
        snapshots
    }

    #[test]
    fn test_storage_budget_thins_newest_tier_first() {
        // 22 snapshots against a 15-slot budget: the 7 evictions must all come from the
        // recent tier, leaving every month of depth intact.
        let snapshots = deep_and_recent();
        let policy = RetentionPolicy {
            storage_budget_bytes: 1_500,
            ..RetentionPolicy::default()
        };
        let decision = plan_retention(&snapshots, &policy, now());
        let kept = kept_names(&decision);

        assert!(decision.budget_exceeded);
        assert!(
            decision.keep.iter().map(|s| s.byte_size).sum::<u64>() <= 1_500,
            "budget was not enforced"
        );
        for month in 1..=12u32 {
            assert!(
                kept.contains(&format!("backup-monthly-{:02}.db", month)),
                "budget thinning evicted monthly snapshot {}, which is time depth",
                month
            );
        }
        assert!(
            decision
                .evict
                .iter()
                .all(|s| s.file_name.contains("recent")),
            "thinning reached past the recent tier while the recent tier still had slack"
        );
        // The newest snapshot is never shed.
        assert!(kept.contains(&"backup-recent-00.db".to_string()));
    }

    #[test]
    fn test_budget_forced_into_the_deep_tier_sheds_its_newest_not_its_oldest() {
        // A budget too small to hold the depth tiers whole. Something in the monthly tier
        // has to go; it must be the month closest to surviving neighbours, never the oldest
        // snapshot in the set.
        let snapshots = deep_and_recent();
        let policy = RetentionPolicy {
            storage_budget_bytes: 1_200,
            ..RetentionPolicy::default()
        };
        let decision = plan_retention(&snapshots, &policy, now());
        let kept = kept_names(&decision);

        assert!(decision.budget_exceeded);
        assert!(
            kept.contains(&"backup-monthly-12.db".to_string()),
            "the oldest snapshot in the set was evicted to satisfy the storage budget"
        );
        // The shallowest end of the monthly tier is what gives way.
        assert!(!kept.contains(&"backup-monthly-01.db".to_string()));
    }

    #[test]
    fn test_storage_budget_never_evicts_the_only_newest_snapshot() {
        let snapshots = vec![snapshot("backup-only.db", now(), 10_000)];
        let policy = RetentionPolicy {
            storage_budget_bytes: 1,
            ..RetentionPolicy::default()
        };
        let decision = plan_retention(&snapshots, &policy, now());

        assert_eq!(kept_names(&decision), vec!["backup-only.db"]);
        assert!(decision.budget_exceeded);
    }

    #[test]
    fn test_budget_scales_with_journal_size() {
        assert_eq!(
            RetentionPolicy::for_journal_size(1_000).storage_budget_bytes,
            MIN_STORAGE_BUDGET_BYTES,
            "the 2 GB floor applies to small journals"
        );
        let big = 4 * 1024 * 1024 * 1024u64;
        assert_eq!(
            RetentionPolicy::for_journal_size(big).storage_budget_bytes,
            big * 3,
            "large journals get 3x their own size"
        );
    }

    // ── should_snapshot ──────────────────────────────────────────────────────────────

    #[test]
    fn test_unchanged_database_produces_no_snapshot() {
        let snapshots = vec![snapshot("backup-a.db", now() - Duration::days(2), 10)];
        let decision = should_snapshot(
            &snapshots,
            &SnapshotTrigger::Unlock,
            Some(1), // matches the manifest's counter
            &RetentionPolicy::default(),
            now(),
        );
        assert_eq!(decision, SnapshotDecision::Skip(SkipReason::Unchanged));
    }

    #[test]
    fn test_changed_database_past_the_interval_produces_a_snapshot() {
        let snapshots = vec![snapshot("backup-a.db", now() - Duration::days(2), 10)];
        let decision = should_snapshot(
            &snapshots,
            &SnapshotTrigger::Unlock,
            Some(2),
            &RetentionPolicy::default(),
            now(),
        );
        assert_eq!(decision, SnapshotDecision::Take);
    }

    #[test]
    fn test_minimum_interval_suppresses_rapid_automatic_snapshots() {
        let snapshots = vec![snapshot("backup-a.db", now() - Duration::minutes(5), 10)];
        let decision = should_snapshot(
            &snapshots,
            &SnapshotTrigger::Unlock,
            Some(99),
            &RetentionPolicy::default(),
            now(),
        );
        assert_eq!(decision, SnapshotDecision::Skip(SkipReason::TooSoon));
    }

    #[test]
    fn test_risky_triggers_bypass_both_rate_limits() {
        // Same inputs that produce Skip for Unlock above.
        let snapshots = vec![snapshot("backup-a.db", now() - Duration::minutes(1), 10)];
        for trigger in [
            SnapshotTrigger::Migration,
            SnapshotTrigger::destructive("reset_diary"),
            SnapshotTrigger::Manual,
            SnapshotTrigger::PreRestore,
        ] {
            assert_eq!(
                should_snapshot(
                    &snapshots,
                    &trigger,
                    Some(1),
                    &RetentionPolicy::default(),
                    now()
                ),
                SnapshotDecision::Take,
                "{:?} must never be skipped",
                trigger
            );
        }
    }

    #[test]
    fn test_unknown_change_counter_errs_toward_taking_a_snapshot() {
        // An adopted pre-upgrade snapshot has no recorded counter. Treating that as
        // "equal to current" would silently skip the first snapshot after an upgrade.
        let mut adopted = snapshot("backup-legacy.db", now() - Duration::days(1), 10);
        adopted.sqlite_change_counter = None;

        assert_eq!(
            should_snapshot(
                &[adopted],
                &SnapshotTrigger::Unlock,
                Some(42),
                &RetentionPolicy::default(),
                now()
            ),
            SnapshotDecision::Take
        );
    }

    #[test]
    fn test_first_ever_snapshot_is_always_taken() {
        assert_eq!(
            should_snapshot(
                &[],
                &SnapshotTrigger::Unlock,
                Some(1),
                &RetentionPolicy::default(),
                now()
            ),
            SnapshotDecision::Take
        );
    }

    #[test]
    fn test_trigger_round_trips_through_json() {
        // The manifest persists this enum; `Destructive` is the variant that needs an
        // owned string on the way back.
        for trigger in [
            SnapshotTrigger::Unlock,
            SnapshotTrigger::Lock,
            SnapshotTrigger::Migration,
            SnapshotTrigger::destructive("run_import_plugin"),
            SnapshotTrigger::Manual,
            SnapshotTrigger::PreRestore,
        ] {
            let json = serde_json::to_string(&trigger).unwrap();
            let back: SnapshotTrigger = serde_json::from_str(&json).unwrap();
            assert_eq!(back, trigger, "round trip failed for {}", json);
        }
    }
}
