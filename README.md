# nearbytes-cli

Nearbytes command-line application.

This repo owns the user-facing CLI and REPL. It consumes protocol packages
instead of defining protocol records itself:

- `nearbytes-files` for file and volume operations.
- `nearbytes-chat` for hub-scoped chat records.
- `nearbytes-skeleton` for config, log, and sync bootstrapping.

## Development

```bash
yarn install
yarn build
yarn nbf --help
```

## Chat

Chat is scoped to the active hub/volume. In the REPL:

```text
volume add team team:secret
volume use team
say hello team
```

One-shot mode can target a hub directly:

```bash
yarn nbf say -s "team:secret" "hello team"
```
