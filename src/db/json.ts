// Sérialisation commune : `id` au lieu de `_id`, sans clé de version.
export const publicJson = {
  virtuals: true,
  versionKey: false,
  transform: (_doc: unknown, ret: Record<string, unknown>) => {
    delete ret._id;
    return ret;
  },
};

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
