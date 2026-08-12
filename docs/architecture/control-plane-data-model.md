# Control Plane Data Model (CLOUD-01B)

Source of truth: migration
[`1786312046358-CreateControlPlaneCore.ts`](../../libs/database/src/migrations/1786312046358-CreateControlPlaneCore.ts).
**Not executed** - the user runs `pnpm migration:run` when ready (see README.md).

## ER diagram

```mermaid
erDiagram
    CUSTOMERS {
        uuid id PK
        varchar_50 code UK
        varchar_200 legal_name
        varchar_200 trade_name "nullable"
        varchar_20 status
        timestamptz created_at
        timestamptz updated_at
    }

    LICENSES {
        uuid id PK
        uuid customer_id "logical ref only - no FK"
        varchar_80 license_number UK
        varchar_20 edition
        varchar_20 license_model
        varchar_20 status
        timestamptz valid_from
        timestamptz valid_until "nullable"
        integer max_installations
        timestamptz created_at
        timestamptz updated_at
    }

    LICENSE_ENTITLEMENTS {
        uuid id PK
        uuid license_id FK
        varchar_100 code
        boolean enabled
        jsonb configuration "nullable"
        timestamptz created_at
        timestamptz updated_at
    }

    INSTALLATIONS {
        uuid id PK
        uuid customer_id "logical ref only - no FK"
        uuid license_id "logical ref only - no FK"
        varchar_80 installation_code UK
        varchar_150 name
        varchar_20 platform
        varchar_20 status
        timestamptz registered_at "nullable"
        timestamptz created_at
        timestamptz updated_at
    }

    LICENSES ||--o{ LICENSE_ENTITLEMENTS : "same-schema FK, ON DELETE CASCADE"
    CUSTOMERS ..o{ LICENSES : "logical only - NOT a PostgreSQL FK"
    CUSTOMERS ..o{ INSTALLATIONS : "logical only - NOT a PostgreSQL FK"
    LICENSES ..o{ INSTALLATIONS : "logical only - NOT a PostgreSQL FK"
```

**The dashed (`..`) lines are not PostgreSQL foreign keys.** They exist only as plain `uuid`
columns, enforced (existence, ownership, capacity) at the application layer via
`CustomerReaderPort`/`LicenseReaderPort` - see
[control-plane-core.md](./control-plane-core.md#cross-context-communication-ports-not-database-access)
and [ADR-010](../adr/ADR-010-no-cross-bounded-context-database-foreign-keys.md). Only the solid
line (`license_entitlements.license_id -> licenses.id`) is a real FK, because both tables belong to
the same bounded context (`licensing`).

## Schemas

| Schema          | Owning bounded context |
| --------------- | ---------------------- |
| `control_plane` | Customer Management    |
| `licensing`     | Licensing              |
| `installations` | Installations          |

## `control_plane.customers`

| Column                      | Type           | Notes                                                    |
| --------------------------- | -------------- | -------------------------------------------------------- |
| `id`                        | `uuid`         | PK                                                       |
| `code`                      | `varchar(50)`  | `UNIQUE`, `NOT NULL`                                     |
| `legal_name`                | `varchar(200)` | `NOT NULL`                                               |
| `trade_name`                | `varchar(200)` | nullable                                                 |
| `status`                    | `varchar(20)`  | `NOT NULL`, `CHECK IN ('ACTIVE','SUSPENDED','INACTIVE')` |
| `created_at` / `updated_at` | `timestamptz`  | `NOT NULL`                                               |

No `deleted_at`. No physical DELETE API.

Defense-in-depth checks (CLOUD-01B-FIX), mirroring the Domain value objects so a direct SQL write
cannot create a row Domain would reject:

- `ck_customers_code_format`: `code ~ '^[A-Z0-9][A-Z0-9_-]{2,49}$'` - same pattern as
  `CustomerCode`. Domain still owns normalization (trim/uppercase); this only rejects the
  un-normalized form (e.g. `gst-mx`).
- `ck_customers_legal_name_length`: `char_length(btrim(legal_name)) >= 2`.
- `ck_customers_trade_name_length`: `trade_name IS NULL OR char_length(btrim(trade_name)) >= 1`.

## `licensing.licenses`

| Column                      | Type          | Notes                                                               |
| --------------------------- | ------------- | ------------------------------------------------------------------- |
| `id`                        | `uuid`        | PK                                                                  |
| `customer_id`               | `uuid`        | `NOT NULL`, no FK (cross-schema)                                    |
| `license_number`            | `varchar(80)` | `UNIQUE`, `NOT NULL`                                                |
| `edition`                   | `varchar(20)` | `NOT NULL`, `CHECK IN ('BASIC','PREMIUM')`                          |
| `license_model`             | `varchar(20)` | `NOT NULL`, `CHECK IN ('PERPETUAL','SUBSCRIPTION')`                 |
| `status`                    | `varchar(20)` | `NOT NULL`, `CHECK IN ('ACTIVE','SUSPENDED','EXPIRED','REVOKED')`   |
| `valid_from`                | `timestamptz` | `NOT NULL`                                                          |
| `valid_until`               | `timestamptz` | nullable, `CHECK (valid_until IS NULL OR valid_until > valid_from)` |
| `max_installations`         | `integer`     | `NOT NULL`, `CHECK (>= 1)`                                          |
| `created_at` / `updated_at` | `timestamptz` | `NOT NULL`                                                          |

Additional checks encode the CLOUD-01B commercial rule directly in the schema, not just the
domain:

- `ck_licenses_edition_license_model` (CLOUD-01B-FIX): `(edition = 'BASIC' AND license_model =
'PERPETUAL') OR (edition = 'PREMIUM' AND license_model = 'SUBSCRIPTION')` - this is the
  constraint that actually enforces edition⇒model. `BASIC`+`SUBSCRIPTION` and
  `PREMIUM`+`PERPETUAL` are both rejected by PostgreSQL, not just by Domain.
- `ck_licenses_perpetual_no_valid_until` / `ck_licenses_subscription_requires_valid_until`:
  `license_model <> 'PERPETUAL' OR valid_until IS NULL` and `license_model <> 'SUBSCRIPTION' OR
valid_until IS NOT NULL` - the `license_model` ⇒ `valid_until` side, separate from the check
  above.
- `ck_licenses_license_number_format` (CLOUD-01B-FIX): `license_number ~
'^[A-Z0-9][A-Z0-9_-]{4,79}$'` - same pattern as `LicenseNumber`.

Indexes: `customer_id`, `status`, `edition`.

## `licensing.license_entitlements`

| Column                      | Type           | Notes                                                                                   |
| --------------------------- | -------------- | --------------------------------------------------------------------------------------- |
| `id`                        | `uuid`         | PK                                                                                      |
| `license_id`                | `uuid`         | `NOT NULL`, **FK -> `licensing.licenses.id` ON DELETE CASCADE** (same-context, allowed) |
| `code`                      | `varchar(100)` | `NOT NULL`                                                                              |
| `enabled`                   | `boolean`      | `NOT NULL`                                                                              |
| `configuration`             | `jsonb`        | nullable                                                                                |
| `created_at` / `updated_at` | `timestamptz`  | `NOT NULL`                                                                              |

Unique: `(license_id, code)`. No separate single-column index on `license_id` (CLOUD-01B-FIX): the
UNIQUE B-tree on `(license_id, code)` already serves lookups filtered by `license_id` alone via
leftmost-prefix matching, so a dedicated index would be redundant write overhead with no read
benefit.

Defense-in-depth checks (CLOUD-01B-FIX):

- `ck_license_entitlements_code`: `code ~ '^[a-z][a-z0-9_]{2,99}$'` - same pattern as
  `EntitlementCode`. Unlike the other identifiers, `EntitlementCode` is not normalized by Domain
  (no trim/case conversion), so this check matches the raw stored value directly.
- `ck_license_entitlements_configuration_object`: `configuration IS NULL OR
jsonb_typeof(configuration) = 'object'` - mirrors `InvalidEntitlementConfigurationError`, rejecting
  a top-level JSON array/string/number/boolean. Nothing about the _contents_ of the object is
  validated at the DB layer (see the "no secrets" note in
  [control-plane-core.md](./control-plane-core.md)).

## `installations.installations`

| Column                      | Type           | Notes                                                                    |
| --------------------------- | -------------- | ------------------------------------------------------------------------ |
| `id`                        | `uuid`         | PK                                                                       |
| `customer_id`               | `uuid`         | `NOT NULL`, no FK (cross-schema)                                         |
| `license_id`                | `uuid`         | `NOT NULL`, no FK (cross-schema)                                         |
| `installation_code`         | `varchar(80)`  | `UNIQUE`, `NOT NULL`                                                     |
| `name`                      | `varchar(150)` | `NOT NULL`                                                               |
| `platform`                  | `varchar(20)`  | `NOT NULL`, `CHECK IN ('WINDOWS','ANDROID','IOS')`                       |
| `status`                    | `varchar(20)`  | `NOT NULL`, `CHECK IN ('PENDING','ACTIVE','SUSPENDED','DECOMMISSIONED')` |
| `registered_at`             | `timestamptz`  | nullable - set only by (future) `Installation.activate()`                |
| `created_at` / `updated_at` | `timestamptz`  | `NOT NULL`                                                               |

Indexes: `customer_id`, `license_id`, `status`.

Defense-in-depth checks (CLOUD-01B-FIX):

- `ck_installations_installation_code_format`: `installation_code ~
'^[A-Z0-9][A-Z0-9_-]{4,79}$'` - same pattern as `InstallationCode`.
- `ck_installations_name_length`: `char_length(btrim(name)) >= 1`.

## Schema ownership (CLOUD-01B-FIX)

`up()` creates `control_plane`, `licensing`, and `installations` with plain `CREATE SCHEMA`
statements - deliberately **without** `IF NOT EXISTS`. This migration is what introduces and owns
these three schemas on a fresh POSPlatform database; if one of them already exists, that is
unexpected shared state this migration does not own, and `up()` must fail loudly rather than
silently adopting someone else's schema. Symmetrically, `down()` drops each schema **without**
`CASCADE`: after the four `DROP TABLE` statements the schemas should be empty, and if they are not
(because something outside this migration created an object inside them), `DROP SCHEMA` fails
safely instead of deleting objects this migration never created. Every `DROP TABLE`/`DROP SCHEMA`
in `down()` cleans up its own constraints and indexes implicitly - there is no separate constraint
or index cleanup step.

## Migration review checklist (static, not executed)

- 3 schemas created (`control_plane`, `licensing`, `installations`), no `IF NOT EXISTS` - confirmed.
- 4 tables created - confirmed.
- Column types match this document and the domain (`timestamptz` throughout, `jsonb` for
  `configuration`) - confirmed.
- Exactly one same-context FK (`license_entitlements.license_id -> licenses.id`), `ON DELETE
CASCADE` - confirmed. No cross-schema FK anywhere - confirmed (0 cross-context FKs).
- `edition`/`license_model` commercial rule (`ck_licenses_edition_license_model`) actually
  enforced by PostgreSQL, not just documented - confirmed.
- Entitlement `code` format (`ck_license_entitlements_code`) and `configuration` JSON-object
  shape (`ck_license_entitlements_configuration_object`) enforced by PostgreSQL - confirmed.
- Normalized identifier formats (`customers.code`, `licenses.license_number`,
  `installations.installation_code`) enforced by PostgreSQL - confirmed.
- `down()` reverses in dependency order: installations table, entitlements, licenses, customers,
  then all three schemas, no `CASCADE` - confirmed.
- No secrets, no `DROP` beyond this migration's own objects, no seed/business data - confirmed.
- Migration executed: **NO**.
