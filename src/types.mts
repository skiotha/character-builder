import type { IncomingMessage, ServerResponse } from "node:http";

import type { FieldAccessMap } from "#rpg-types";

export type {
  PrimaryAttributes,
  PrimaryAttributeName,
  Toughness,
  SecondaryAttributes,
  CharacterAttributes,
  EffectModifier,
  Effect,
  AbilityTier,
  LearnedAbility,
  LearnedSpell,
  LearnedRitual,
  LearnedBoon,
  LearnedSin,
  Combat,
  Weapon,
  ArmorPiece,
  Rune,
  CharacterEquipment,
  Affiliation,
  JournalEntry,
  CharacterBackground,
  PortraitCrop,
  PortraitDimensions,
  CharacterPortrait,
  RoleAccess,
  FieldAccessMap,
  Character,
} from "#rpg-types";

// ── Character Role & Permissions ──────────────────────────────────

export type CharacterRole = "dm" | "owner" | "public";

export interface CharacterPermissions {
  role: CharacterRole;
}

// ── Request Extension ─────────────────────────────────────────────

export interface NagaraRequest extends IncomingMessage {
  character?: Record<string, unknown>;
  characterPermissions?: CharacterPermissions;
}

// ── Handler Signatures ────────────────────────────────────────────

export type RouteHandler = (
  req: NagaraRequest,
  res: ServerResponse,
) => Promise<boolean | void> | boolean | void;

export type MiddlewareFn = (
  req: NagaraRequest,
  res: ServerResponse,
  pathParts: string[],
  next: () => Promise<void>,
) => Promise<boolean | void> | boolean | void;

export type MiddlewareChainHandler = (
  req: NagaraRequest,
  res: ServerResponse,
  pathParts: string[],
  finalHandler?: RouteHandler,
) => Promise<boolean>;

// ── Character Index (data/index.json) ─────────────────────────────

export interface CharacterIndexEntry {
  name: string;
  playerId: string;
  backupCode: string;
  created: string;
  deleted?: boolean;
  deleteAt?: string;
  deletedAt?: string;
}

export interface CharacterIndex {
  byId: Record<string, CharacterIndexEntry>;
  byBackupCode: Record<string, string>;
  byPlayer: Record<string, string[]>;
  all: string[];
}

// ── Schema Field Descriptor ───────────────────────────────────────

export interface SchemaFieldUI {
  label?: string;
  placeholder?: string;
  help?: string;
  order?: number;
  hidden?: boolean;
  quickActions?: string[];
}

export interface SchemaField {
  type?: string;
  required?: boolean;
  serverControlled?: boolean;
  generated?: boolean;
  immutable?: boolean;
  derived?: boolean;
  default?: unknown;
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  integer?: boolean;
  pattern?: RegExp;
  sanitize?: string;
  error?: string;
  permissions?: FieldAccessMap;
  validate?: (value: unknown, allData: unknown) => boolean | string;
  ui?: SchemaFieldUI;
  [key: string]: unknown;
}

// ── Update Operations ─────────────────────────────────────────────

export type UpdateOperation = "set" | "increment" | "push";

export interface FieldUpdate {
  field: string;
  value: unknown;
  operation?: UpdateOperation;
}

// ── Validation Results ────────────────────────────────────────────

export interface ValidationError {
  field: string;
  error: string;
  code: string;
}

export interface ValidationWarning {
  field: string;
  message: string;
}

export interface ValidationResult {
  success: boolean;
  validatedData: Record<string, unknown> | null;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface UpdateValidationResult {
  validUpdates: FieldUpdate[];
  errors: ValidationError[];
}

// ── Backup Records ────────────────────────────────────────────────

export interface BackupRecord {
  id: string;
  characterId: string;
  timestamp: string;
  trigger: string;
  note: string;
  file: string;
}

// ── Delete Results ────────────────────────────────────────────────

export interface DeleteResult {
  success: boolean;
  error?: string;
  statusCode?: number;
  status?: number;
  type?: string;
  message?: string;
}

// ── SSE Client ────────────────────────────────────────────────────

export interface SSEClient {
  res: ServerResponse;
  playerId: string | null;
  isDM: boolean;
}

// ── Multipart ─────────────────────────────────────────────────────

export interface ParsedImage {
  filename: string;
  stream: import("node:stream").Readable;
}
