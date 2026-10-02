# Release History and Provenance

Mira is published as an independent repository for the Mira desktop application. The available Git history originated in a local Profer codebase that itself preserves Proma ancestry. The source history and version tags are retained where practical. This public history excludes project-local instructions, private working notes, internal product plans, deployment material, legacy direct-upload tools, and build output. The standalone Mira repository docs and release workflow replace those private project records.

## Source tags

- Existing release tags from the local source repository are preserved as source-history markers. Their presence does not imply that a corresponding installer is available here.
- `v0.15.86` is the latest historical source tag available from the local source repository. It points to Electron package version `0.15.86`.
- The Mira 1.1.0 and 1.1.1 package metadata existed only in the local working tree and ignored build output; those installers do not correspond to tags in the original source history and are not presented as releases of this repository.
- `v1.1.2` is the first public Mira source snapshot. It includes the top-tab horizontal sorting fix, uses the Mira GitHub Releases repository for update checks, and is built from the matching source commit.
- Installer binaries are distributed separately through GitHub Releases. Download only assets attached to a published release, and check their published hashes.

## Available packages at repository setup

The public Windows workflow builds an unsigned verification installer from tag `v1.1.2`; it does not publish assets or write to a Profer update server. The installer is unsigned, so Windows displays its standard security warning. The unsigned asset manifest and packaged Pi runtime closure are checked as part of packaging.

## Building from source

Follow the requirements and commands in the root README. Historical source tags may have different runtime, dependency, and build requirements. A source tag is not a substitute for its original installer or release notes.

## Names in the history

The desktop product name changed over time. Earlier source commits and package names may use `Proma` or `Profer`; this repository's public desktop release line starts at Mira 1.1.2 under the `Mira_AI` repository name. Historical source identifiers are retained for provenance rather than rewritten.
