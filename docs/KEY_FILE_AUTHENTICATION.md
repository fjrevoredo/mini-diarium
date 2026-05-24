# Key File Authentication

Mini Diarium supports unlocking a journal with an **X25519 private key file** (a `.key` file), similar in spirit to SSH key authentication.

You can use a key file instead of your password, or register both as separate authentication methods. Each method independently wraps the same master encryption key, so adding or removing a method does **not** require re-encrypting your entries.

For the full threat model and cryptographic details, see [SECURITY.md](../SECURITY.md).

## Why use a key file?

| Scenario                          | How a key file helps                                                                                                                                    |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Physical second factor**        | Keep the `.key` file on a USB drive. The journal can only be unlocked when the drive is plugged in, with no app, no phone, and no OTP codes.            |
| **Password manager integration**  | Store the `.key` file as a secure attachment. Unlock without memorizing a passphrase at all.                                                            |
| **Multiple machines**             | Register one key file per machine. Revoke access to a single machine by removing that slot without touching your password or re-encrypting any entries. |
| **Shared journal, separate keys** | Register several key files under different labels. Each is independent, and removing one doesn't affect the others.                                     |

## How it works (high level)

Each authentication method stores its own encrypted copy of the journal's random **master key** (the master key encrypts entry content using AES-256-GCM).

For key files, wrapping uses X25519 ECDH + HKDF-SHA256 to derive a wrapping key, then AES-256-GCM to encrypt the master key.

The private key never enters the database. Only a public key is stored alongside the wrapped master key.

## Setting up a key file

1. Open **Preferences → Security → Authentication Methods**
2. Add a **Key File** authentication method and give it a label (e.g. "USB drive" or "laptop")
3. If your journal has a password method registered, you’ll be prompted for your current password to authorize the change
4. Choose where to save the generated `.key` file (the file contains the private key as a hex string)

After that, you can unlock from the login screen by switching to **Key File** mode and selecting your `.key` file.

> **Back up your key file.** Like an SSH private key, it cannot be regenerated. If you lose all registered authentication methods (password forgotten and key files lost), there is no recovery path.

