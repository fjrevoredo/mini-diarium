---
title: "Password-Protected Journal App: What It Really Means"
slug: password-protected-journal-app
description: A password on a journal app can mean a login screen or real encryption. Here is how to tell the difference, and what locking one entry actually protects.
date: 2026-07-13
updated: 2026-07-13
author: Francisco J. Revoredo
tags: password protected journal, encrypted journal, private diary app, offline journal
draft: false
---

When people search for a password-protected journal app, they usually mean one thing: they want their entries safe if someone else picks up the device. The problem is that "password-protected" describes two completely different designs. One adds a login screen in front of readable files. The other encrypts the entries so the files themselves are unreadable without the key. Only the second one actually protects your writing.

This post explains the difference, then answers the specific questions people ask about passwords and locking individual entries, because those two ideas are often confused.

## A login screen is not encryption

A password screen controls what the app shows you. It does not necessarily change what is written to disk. If the journal database still contains readable text, anyone who copies that file to another machine can open it without ever seeing your password. The login prompt only guards the front door of the app, not the data behind it.

Encryption at rest is the real guarantee. It means each entry is turned into ciphertext with a key before it is written to permanent storage. Without the key, the file on disk is meaningless. The test is simple: if you copy the journal file to another computer, can you read the entries without the password? If yes, the password was cosmetic.

So the useful question is not "does it have a password" but "does the password unlock a key that decrypts the entries, or does it just hide a readable file?"

## One journal password versus per-entry passwords

A common follow-up question is whether you can put a separate password on individual entries. It helps to separate two different goals here.

The first goal is confidentiality: keeping the entire journal unreadable to anyone without the credential. This is best handled by encrypting the whole journal behind one strong key. Every entry is protected by the same encryption, and you unlock the journal once per session.

The second goal is often stated as "lock certain entries," but on inspection most people mean something narrower: they want to avoid accidentally editing or deleting a specific entry, not encrypt it under a second password. Those are different needs. A per-entry password implies per-entry encryption, which is complex and rarely what the situation calls for. An edit lock is a small flag that prevents accidental changes while the journal is already unlocked.

Being precise about this matters, because an app that advertises "lock individual entries" may only be offering the edit lock, not a second layer of encryption. Ask which one it is.

## What "does it have a password" should actually tell you

When you evaluate a password-protected journal app, look for answers to these specific questions:

- Does the password unlock an encryption key, or just a UI screen?
- What encrypts the entries on disk? Look for a named algorithm such as AES-256-GCM, not "bank-level security."
- Is there a recovery backdoor? If the vendor can reset your password and still show your entries, the vendor can read them too.
- Does locking an entry encrypt it separately, or only prevent accidental edits?

An app that answers these plainly is being honest about its security model. An app that only says "password protected" without saying what the password protects is describing a login screen.

## Where Mini Diarium fits

Mini Diarium encrypts the entire journal with AES-256-GCM. The whole database is protected by a single master key, and every entry is encrypted before it is written to the local SQLite file. Plaintext never touches disk. You unlock the journal once with either a password or a key file. Password unlock derives its key with Argon2id and uses it to unwrap the master key; the key-file option uses an X25519 key that works like an SSH private key. There is also a passwordless option for journals locked to one device with a device-bound key.

There is no per-entry password and no per-entry encryption, because the whole journal is already encrypted under one key. What Mini Diarium does offer at the entry level is a lock that protects an entry against accidental edits and deletion once the journal is open. That lock is a convenience flag, not a second encryption layer or a separate password. It is honest to describe it that way.

There is no recovery backdoor. If you lose both the password and the key file, the entries cannot be recovered, because Mini Diarium has no copy of your key. That is the trade-off of real encryption: the same property that keeps others out keeps you out if you lose the credential.

## The practical takeaway

If you want a password-protected journal, decide what the password needs to protect. If you only want a login screen, almost any app qualifies. If you want your entries unreadable when the file is copied elsewhere, require encryption at rest with a named algorithm and no recovery backdoor.

For the underlying concept, read [what an encrypted diary actually is](/blog/what-is-an-encrypted-diary/), which covers encryption at rest in plain terms. For the full evaluation checklist, see [how to choose a private journal app](/blog/private-journal-app-how-to-choose/). If you want the product overview, the [encrypted journal guide](/encrypted-journal/) explains how Mini Diarium handles the whole-journal model described here.
