# Glossary

Mappings between user-facing Portuguese (pt-BR) terminology and English code identifiers.

| pt-BR (user-facing)       | en-US (code)          | Notes |
|---------------------------|-----------------------|-------|
| Partitura                 | Song / Score          | `Song` in Firestore/domain model; `Score` in the legacy collection format |
| Revisão                   | Revision              | A versioned upload of a song |
| Acervo @username          | Default project       | Auto-created personal project for each user; display name keeps pt-BR "Acervo @" prefix |
| Projeto                   | Project               | A named collection of songs |
| Compositor                | Composer              | |
| Sub / Verso referência    | Sub                   | Reference verse field from MuseScore `source` |
| Tags / Estilo             | Tags                  | First tag is the music style |
| Caderninho                | Song book / SongBook  | User-assembled playlist/booklet |
| Seção                     | Section               | A titled divider within a song book |
| Instrumento               | Instrument            | |
| Parte                     | Part                  | One instrument's sheet within a score; a score may contain multiple parts for the same instrument |
