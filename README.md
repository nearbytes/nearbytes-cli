# nearbytes-cli

Nearbytes command-line application and REPL.

This repo owns the user-facing `nbf` app. It consumes protocol packages instead
of defining protocol records itself:

- [`nearbytes-files`](https://github.com/nearbytes/nearbytes-files) for file and
  volume operations.
- [`nearbytes-chat`](https://github.com/nearbytes/nearbytes-chat) for
  hub-scoped chat records.
- [`nearbytes-skeleton`](https://github.com/nearbytes/nearbytes-skeleton) for
  config, log, and sync bootstrapping.

## Quickstart

```sh
yarn install
yarn repl
```

Inside the REPL:

```text
# 1) Create and activate a sync profile
profile add myprofile "your profile secret words"
profile use myprofile

# 2) Register and open a hub/volume
volume add myvol "myvol:strong-password"
volume use myvol

# 3) Files
file add ./hello.txt
ls

# 4) Hub-scoped chat
say hello everyone
chat
```

To join a hub/volume someone shared, register the secret they gave you:

```text
volume add teamdocs "shared-name:shared-password"
volume use teamdocs
ls
chat
```

To sync with someone, exchange profile public keys and add them as friends:

```text
profile list
friend add <their-profile-public-key-hex>
```

## Run

| Command | What it does |
|---------|--------------|
| `yarn dev` | Stops stale `nbf` listeners, then starts REPL + `--dev-inspect` |
| `yarn repl` | Interactive REPL; no subcommand also defaults to REPL |
| `yarn repl -d <dir>` | REPL against a custom data directory |
| `yarn repl --dev-inspect` | REPL plus loopback JSON debug API on port 9845 |
| `yarn nbf <args>` | One-shot command |
| `yarn nbf -d <dir> <subcmd>` | One-shot command against a custom data directory |
| `yarn nbf repl` | Same as `yarn repl` |

Global flags (`-c <config>`, `-d <data-dir>`) must precede the subcommand.

Yarn 4 note: do not use `--` between the script name and args. Use
`yarn repl -d /tmp/foo`, not `yarn repl -- -d /tmp/foo`.

## Profiles

A profile is a sync/social keypair, not a file volume and not a chat container.
Profiles are used for sync topics, friend following, WebDAV auth, and signing
identity records.

```text
profile add alice "alice:strong-secret"
profile use alice
profile list
profile show
profile publish Alice "optional bio"
```

The first profile becomes active. Sync can serve multiple profiles; the active
profile is used for outbound dials and profile publication.

## Hubs / Volumes

Current user-facing commands call the shared channel a volume. Chat is scoped to
that same channel; hub and volume refer to the same thing in this CLI.

```text
volume add myvol "myvol:password"
volume use myvol
volume list
volume forget myvol
```

Registered volumes persist in:

```text
<dataDir>/.nearbytes/volume-session.json
```

The file is written with mode `0600` because it stores cleartext secrets.

## Files

After `volume use`, file commands use the active volume.

```text
put ./doc.pdf
ls
get doc.pdf /tmp/doc.pdf
mkdir notes
mv doc.pdf notes/doc.pdf
rm notes/doc.pdf
```

One-shot examples:

```sh
yarn nbf setup -s "myvol:password"
yarn nbf file add -p ./hello.txt -s "myvol:password"
yarn nbf file list -s "myvol:password"
yarn nbf timeline -s "myvol:password"
yarn nbf file get -n hello.txt -o /tmp/hello.txt -s "myvol:password"
```

## Chat

Chat is hub/volume-scoped. Messages are `nb.chat.message.v1` app records in the
active hub log. Profiles are not the chat container.

REPL:

```text
volume use team
say hello team
chat
chat 50
```

One-shot:

```sh
yarn nbf say -s "team:secret" "hello team"
yarn nbf chat -s "team:secret" -n 50
```

`say` writes the message and then prints the recent chat timeline for that hub.
`chat` reads the hub log and displays chat records from all synced writers that
share the hub secret.

## Timeline

```text
timeline
timeline goto <#|date|hash>
timeline live
```

`timeline` lists events in causal replay order. `timeline goto` moves a
read-only cursor. While the cursor is before the head, WebDAV shows the
historical snapshot and mutating file commands are refused until `timeline live`.

## WebDAV

Starting the REPL starts a local HTTPS WebDAV server:

```text
https://127.0.0.1:9843/
```

Requirements:

- An active profile (`profile add` / `profile use`).
- At least one registered volume (`volume add` / `volume use`).

The mount root shows registered volumes as folders:

```text
https://127.0.0.1:9843/
  myvol/
  teamdocs/
```

Credentials:

- Username: active profile name.
- Password: that profile's secret, or the part after `:` when using
  `name:password`.

On macOS Finder, use **Go -> Connect to Server...** and enter
`https://127.0.0.1:9843/`.

Useful commands:

```text
webdav status
webdav refresh
webdav logout
```

## Dev Inspect

Start with:

```sh
yarn repl --dev-inspect
```

Then query:

```sh
curl http://127.0.0.1:9845/health
curl http://127.0.0.1:9845/volumes
curl http://127.0.0.1:9845/view
curl 'http://127.0.0.1:9845/replay/myvol?at=live'
curl 'http://127.0.0.1:9845/replay/myvol?at=32'
curl 'http://127.0.0.1:9845/replay/myvol?at=cursor'
```

## Sync / Daemon Coexistence

`nbf` can run against the same `dataDir` as a running
[`nbsync`](https://github.com/nearbytes/nearbytes-sync) daemon. If the daemon
holds the sync lock, the CLI downgrades to writer-only mode: local writes still
append to the log, and the daemon notices and replicates them.

One-shot mutating commands wait for sync to drain before exiting when appropriate.

## Help

```sh
yarn nbf --help
yarn nbf say --help
yarn nbf chat --help
```

Inside the REPL:

```text
help
```

Tab completion knows commands, options, local paths, remote filenames, secrets,
and friend keys.
