const PHONE_FIELDS = new Set(['vContact', 'contact']);
const NAME_FIELDS = new Set(['vName', 'sTitle', 'title', 'vZone']);
// sLocation uses only a required check (no length limit — display_name from Nominatim can be long)
const DESCRIPTION_FIELDS = new Set(['sDescription', 'description', 'vHelpType']);

export function getValidationErrorKey(name: string, value: string): string | null {
  if (PHONE_FIELDS.has(name)) {
    const phoneRegex = /^[0-9+\s-]+$/;
    const digitsOnly = value.replace(/[^0-9]/g, '');
    if (!phoneRegex.test(value) || digitsOnly.length < 7 || digitsOnly.length > 15) {
      return 'validation.phone_invalid';
    }
    return null;
  }

  if (NAME_FIELDS.has(name)) {
    const trimmed = value.trim();
    if (trimmed.length < 2 || trimmed.length > 40) {
      return 'validation.name_invalid';
    }
    return null;
  }

  if (DESCRIPTION_FIELDS.has(name)) {
    const trimmed = value.trim();
    if (trimmed.length < 10 || trimmed.length > 500) {
      return 'validation.description_min';
    }
    return null;
  }

  return null;
}
