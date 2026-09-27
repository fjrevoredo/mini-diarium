//! Encrypted file attachments (non-image files linked to entries).
//!
//! Storage mirrors `images`: `attachments` is a content-addressed encrypted blob store
//! (deduplicated by the keyed HKDF fingerprint), and `entry_attachments` links an entry
//! to a blob. Unlike images, the **file name lives on the link row**, encrypted, so the
//! same bytes attached to two entries keep two independent names.
//!
//! Ownership is explicit: only [`add_attachment_to_entry`] and
//! [`remove_attachment_from_entry`] touch `entry_attachments`. The entry save path never
//! scans entry HTML for attachments — an inline `<span data-attachment-ref="N">` in the
//! text only *points to* an attachment and never owns it.
//!
//! Split by responsibility: [`storage`] (validation + row CRUD), [`mime`] (extension →
//! MIME lookup), and [`refs`] (inline `data-attachment-ref` span rewriting).

mod mime;
mod refs;
mod storage;

pub use mime::*;
pub(crate) use refs::{attachment_ref_span, rewrite_attachment_refs};
pub use storage::*;

/// Metadata-only view of one attachment as linked to one entry. Never carries bytes —
/// attachment content never crosses IPC.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct AttachmentSummary {
    pub id: i64,
    /// The file name for this entry (decrypted from the link row).
    pub name: String,
    pub mime_type: String,
    pub byte_size: i64,
    /// When the attachment was linked to this entry (RFC 3339).
    pub created_at: String,
}
