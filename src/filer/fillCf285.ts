/**
 * Fill the official CF 285 (8/21) AcroForm from a HouseholdProfile mapping.
 * pdf-lib runs at request time on the server (Node-only, no network).
 * The blank official form is vendored at forms/cf285-8-21.pdf with its
 * source URL recorded in cf285Map.ts — never regenerated, never substituted
 * (the form footer itself says "SUBSTITUTES NOT PERMITTED").
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { PDFDocument } from 'pdf-lib';
import type { HouseholdProfile, FilledApplication } from '../contracts.ts';
import { mapProfileToCf285 } from './cf285Map.ts';

const FORM_PATH = fileURLToPath(new URL('../../forms/cf285-8-21.pdf', import.meta.url));

export async function fillCf285(profile: HouseholdProfile): Promise<{ pdf: Uint8Array; app: Omit<FilledApplication, 'pdfUrl'> }> {
  const fill = mapProfileToCf285(profile);
  // The official form ships with (empty-password) permissions encryption;
  // pdf-lib refuses by default. We fill fields — we do not alter the form.
  const doc = await PDFDocument.load(await readFile(FORM_PATH), { ignoreEncryption: true });
  const form = doc.getForm();

  for (const [fieldId, value] of Object.entries(fill.text)) {
    form.getTextField(fieldId).setText(value);
  }
  for (const fieldId of fill.check) {
    form.getCheckBox(fieldId).check();
  }

  const pdf = await doc.save();
  return {
    pdf,
    app: {
      program: 'CalFresh',
      fields: fill.filled,
      status: 'ready_for_review', // NEVER 'submitted' — that status does not exist here
      blankFields: fill.blankFields,
      notes: fill.notes,
    },
  };
}
