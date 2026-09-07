pub(crate) mod peek;
pub(crate) mod queries;
pub(crate) mod schema;

// ── Curated public façade (the API contract — see crates/mini-diarium-core/API.md) ──
//
// The `queries` and `schema` sub-modules are sealed to the crate; consumers reach the
// database layer only through the names re-exported here at the `db` root.

pub use schema::{
    create_database, create_database_auto, open_database, open_database_auto,
    open_database_with_keypair, DatabaseConnection, SCHEMA_VERSION,
};

// Locked-journal metadata — the one `db` read that needs no handle and no key.
pub use peek::{peek_auth_slot_types, AuthSlotPeek, JournalPeek};

// Grouped by concern to mirror API.md; `rustfmt::skip` keeps the grouping (rustfmt would
// otherwise flatten it into one alphabetical list).
#[rustfmt::skip]
pub use queries::{
    // Types
    DiaryEntry, EntryMetadata, TimelineRow, Tag,
    ImageData, ImageSummary, ImageSummaryPage, ImageSummarySort,
    WordCountRecalculationResult,
    // Entry CRUD
    count_words, delete_entry_by_id, get_all_entries, get_all_entry_dates, get_entries_by_date,
    get_entries_for_timeline, get_entries_in_range, get_entry_by_id, get_locked_entry_dates,
    insert_entry, insert_entry_with_images, is_entry_locked, recalculate_all_word_counts,
    set_entry_locked, update_entry, update_entry_with_images,
    // Tags
    add_tag_to_entry, create_tag, delete_tag, get_all_tags, get_entry_dates_by_tag,
    get_tags_for_entry, get_tags_names_map, remove_tag_from_entry, rename_tag,
    // Images
    get_image_by_id, get_images_for_entry, list_image_summaries_filtered,
    resolve_image_refs_in_entries,
    // Auth slots
    count_auth_slots, delete_auth_slot, get_auth_slot_type, get_keypair_slot_by_pubkey,
    get_password_slot, insert_auth_slot, list_auth_slots, update_auth_slot_wrapped_key,
    update_slot_last_used,
    // db_settings wrappers (operate on &DatabaseConnection)
    delete_db_setting, get_db_setting, set_db_setting, verify_require_all_auth,
    write_require_all_auth_mac,
    // Schema / engine / entry-stats introspection
    get_entry_date_word_counts, read_content_counts, read_engine_versions, read_schema_version,
    ContentCounts,
    // Custom fonts
    custom_font_has_weight, delete_custom_font_family, get_custom_font_weight_data,
    list_custom_font_rows, upsert_custom_font,
};
