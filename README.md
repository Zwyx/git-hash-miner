# Git Hash Miner

Command line utility to generate custom commit hashes.

## Installation

```
npm i -g git-hash-miner
```

## Usage

In a Git repository, after creating a commit:

```
gmr [--auto-amend|-a] <target>
```

where `target` is the characters we want the commit hash to start with, and `-a` auto amends the commit if the target is found. Do some tests without `-a` first.

## Example

This command has been run after the last commit in the repository of Git Hash Miner:

```
gmr -a badc0de
```

## Note

If you sign your commits with GPG, the commit signature is dropped when using Git Hash Miner.
