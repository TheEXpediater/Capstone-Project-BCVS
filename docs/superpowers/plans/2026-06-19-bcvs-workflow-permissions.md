# BCVS Workflow Permissions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce the corrected BCVS VC lifecycle, cashier anchor selection, role permissions, and mobile verification onboarding while keeping the stored role schema unchanged.

**Architecture:** Keep backend permissions authoritative by tightening effective credential permissions and service-level guards first, then align the React and Expo UIs to hide actions that the server rejects. Use existing statuses as the lifecycle vocabulary: `draft` for editable staff drafts, `for_signature` for submitted records, `signed` for registrar-signed credentials, `claim_ready` for paid signed credentials with a claim QR, `queued_for_anchor` for scheduled anchoring, and `anchored` for completed anchor proofs.

**Tech Stack:** Node/Express/Mongoose backend, React/Vite web client, Expo React Native mobile app, existing Jest/Vitest and npm validation scripts.

---

## File Structure

- Modify `server/src/modules/settings/setting.service.js` so default effective permissions are role-correct: `admin` can manage drafts only, `super_admin` can sign/anchor/claim QR, `developer` is read-only, `cashier` is payment-only.
- Modify `server/src/modules/settings/adminPermission.model.js` so newly created permission overrides do not default lifecycle permissions to enabled.
- Modify `server/src/modules/credentials/service.js` to centralize role messages, enforce draft-only edits, allow registrar signing before payment, persist cashier anchor selection at payment confirmation, queue anchor work once a signed credential becomes paid, and reject MIS/developer lifecycle actions server-side.
- Modify `server/src/modules/credentials/routes.js` only where route-level role gates still expose lifecycle mutations to `developer`.
- Modify or add backend tests under `server/tests` or the existing credentials test folder to lock role rejection, cashier anchor mode persistence, and signed-plus-paid claim/anchor eligibility.
- Modify `client/src/features/credentials/pages/CredentialDraftsPage.jsx` to align visible actions and bulk actions with the authoritative backend permissions, label `super_admin` as Registrar in workflow UI, keep claim QR visible after signed plus paid, and keep anchor-tab rows visible for queued or pending-anchor credentials.
- Modify verifier UI/service files found by `rg "anchoredOnChain|signatureValid|Verification" client/src Mobile server/src/modules/verification` so signed credentials produce a positive signature/credential result even while anchor status is pending.
- Modify `Mobile/app/(auth)/register.jsx` to reduce registration to Email, Password, Confirm Password.
- Modify `Mobile/app/verification/account.jsx` to remove account fields from verification, use the four visible review steps plus submit state, remove separate liveness proof image upload, and keep FaceVerifier as the liveness mechanism.
- Modify `Mobile/services/verificationService.js` and backend verification upload parsing files so submission sends and accepts liveness metadata without a `selfie`/`livenessImage` file.

---

### Task 1: Backend Role Authority

**Files:**
- Modify: `server/src/modules/settings/setting.service.js`
- Modify: `server/src/modules/settings/adminPermission.model.js`
- Modify: `server/src/modules/credentials/service.js`
- Modify: `server/src/modules/credentials/routes.js`
- Test: existing credential/settings permission tests, or add `server/tests/credentials.permissions.test.js` if no focused file exists

- [ ] **Step 1: Write failing role permission tests**

Add tests that express the final role matrix:

```js
expect(await getEffectivePermissions({ role: 'admin' })).toMatchObject({
  canManageVC: true,
  canSignVC: false,
  canGenerateClaimQr: false,
  canAnchorVC: false,
  canConfirmPayments: false,
});
expect(await getEffectivePermissions({ role: 'super_admin' })).toMatchObject({
  canManageVC: true,
  canSignVC: true,
  canGenerateClaimQr: true,
  canAnchorVC: true,
});
expect(await getEffectivePermissions({ role: 'developer' })).toMatchObject({
  canManageVC: false,
  canSignVC: false,
  canGenerateClaimQr: false,
  canAnchorVC: false,
  canConfirmPayments: false,
});
expect(await getEffectivePermissions({ role: 'cashier' })).toMatchObject({
  canConfirmPayments: true,
  canManageVC: false,
  canSignVC: false,
  canGenerateClaimQr: false,
  canAnchorVC: false,
});
```

- [ ] **Step 2: Run the focused tests and confirm failure**

Run: `cd server; npm.cmd test -- --runInBand credentials.permissions`

Expected before implementation: failures showing `admin` and `developer` still have lifecycle permissions.

- [ ] **Step 3: Tighten backend defaults and guards**

Set `DEFAULT_CREDENTIAL_PERMISSIONS` and settings defaults to this matrix:

```js
const DEFAULT_CREDENTIAL_PERMISSIONS = Object.freeze({
  admin: {
    canConfirmPayments: false,
    canManageVC: true,
    canSignVC: false,
    canGenerateClaimQr: false,
    canAnchorVC: false,
  },
  super_admin: {
    canConfirmPayments: false,
    canManageVC: true,
    canSignVC: true,
    canGenerateClaimQr: true,
    canAnchorVC: true,
  },
  developer: {
    canConfirmPayments: false,
    canManageVC: false,
    canSignVC: false,
    canGenerateClaimQr: false,
    canAnchorVC: false,
  },
  cashier: {
    canConfirmPayments: true,
    canManageVC: false,
    canSignVC: false,
    canGenerateClaimQr: false,
    canAnchorVC: false,
  },
});
```

Update lifecycle guards so mutation messages are role-neutral:

```js
const REGISTRAR_ROLE = 'super_admin';
const STAFF_DRAFT_ROLES = new Set(['admin', REGISTRAR_ROLE]);

function assertStaffDraftActor(actor) {
  if (!STAFF_DRAFT_ROLES.has(actor?.role)) {
    const error = new Error('Only staff or registrar users can manage credential drafts.');
    error.status = 403;
    throw error;
  }
}

function assertRegistrar(actor, message = 'Only registrar users can perform this credential action.') {
  if (actor?.role !== REGISTRAR_ROLE) {
    const error = new Error(message);
    error.status = 403;
    throw error;
  }
}
```

- [ ] **Step 4: Restrict route-level mutation roles**

Keep read routes available to diagnostic roles where already intended, but remove `developer` from lifecycle mutation route guards such as submit, update, delete, sign, claim QR, schedule anchor, process anchor, and mark claimed. Keep payment confirmation limited to `cashier` plus any role explicitly permitted by the new effective permissions.

- [ ] **Step 5: Re-run focused role tests**

Run: `cd server; npm.cmd test -- --runInBand credentials.permissions`

Expected: tests pass and unauthorized developer/admin lifecycle actions return 403 from service or route tests.

### Task 2: Backend VC Lifecycle and Cashier Anchor Selection

**Files:**
- Modify: `server/src/modules/credentials/service.js`
- Test: existing credentials service tests, or add focused lifecycle cases beside them

- [ ] **Step 1: Write failing lifecycle tests**

Cover these cases:

```js
await expect(updateCredentialDraft(forSignatureId, patch, adminActor))
  .rejects.toThrow(/Only unsigned draft credentials can be edited/i);
await expect(signCredentialDraft(forSignatureUnpaidId, {}, registrarActor))
  .resolves.toMatchObject({ status: 'signed', paymentStatus: 'unpaid' });
await expect(markCredentialPaymentPaid(signedDraftId, { anchorMode: 'anchor_now', amount: 170 }, cashierActor))
  .resolves.toMatchObject({
    paymentStatus: 'paid',
    anchorMode: 'anchor_now',
    anchorStatus: 'queued',
    status: 'queued_for_anchor',
  });
await expect(createCredentialClaimToken(signedPaidDraftId, {}, registrarActor))
  .resolves.toHaveProperty('claimQrData');
```

- [ ] **Step 2: Run lifecycle tests and confirm failure**

Run: `cd server; npm.cmd test -- --runInBand credentials`

Expected before implementation: edit of `for_signature` succeeds, signing unpaid is blocked unless `allowUnpaid`, and cashier `anchorMode` is ignored.

- [ ] **Step 3: Make draft edits draft-only**

Change the edit helper to:

```js
function canEditCredentialDraft(draft) {
  if (hasIssuedCredentialArtifacts(draft)) return false;
  return draft?.status === 'draft';
}
```

Update the edit rejection text to: `Only unsigned draft credentials can be edited.`

- [ ] **Step 4: Allow registrar signing before payment**

Remove the payment gate from `signCredentialDraft`. Keep status and registrar checks. After signing:

```js
draft.status = draft.paymentStatus === 'paid' ? 'claim_ready' : 'signed';
draft.signedAt = now;
draft.signedBy = actor?._id || null;
```

If the credential is already paid and its persisted anchor mode is `anchor_now`, queue anchoring immediately.

- [ ] **Step 5: Persist cashier anchor selection and queue eligible signed payments**

In `markCredentialPaymentPaid`, read and validate `payload.anchorMode` as `default` or `anchor_now`, recalculate amount from that mode, and save:

```js
draft.anchorMode = selectedAnchorMode;
draft.anchorScheduleMode = selectedAnchorMode === 'anchor_now' ? 'same_day' : 'scheduled';
draft.scheduledAnchorAt = selectedAnchorMode === 'anchor_now'
  ? now
  : addDays(now, settings.anchoring?.intervalDays || 7);
```

When the draft already has a signed VC, set:

```js
draft.anchorStatus = 'queued';
draft.status = 'queued_for_anchor';
```

When it is paid but not yet signed, leave `anchorStatus` as `not_requested` and let signing queue it after registrar approval.

- [ ] **Step 6: Keep claim QR independent from on-chain anchor**

Keep `canGenerateClaimToken` requiring `paymentStatus === 'paid'`, `signedCredential`, and a claimable status. Do not add an anchor requirement. Generating the claim QR should set `status = 'claim_ready'` only when the credential is not already `queued_for_anchor`, `anchored`, `claimed`, or `shared`.

- [ ] **Step 7: Re-run lifecycle tests**

Run: `cd server; npm.cmd test -- --runInBand credentials`

Expected: all lifecycle and cashier anchor selection tests pass.

### Task 3: Web Credential Workflow UI

**Files:**
- Modify: `client/src/features/credentials/pages/CredentialDraftsPage.jsx`
- Test: existing client tests if present; otherwise validate through build, route validation, lint, and targeted text searches

- [ ] **Step 1: Update role constants and labels**

Use this role mapping in the page:

```js
const STAFF_DRAFT_ROLES = new Set(['admin', 'super_admin']);
const REGISTRAR_ROLES = new Set(['super_admin']);
const PAYMENT_TAB_ROLES = new Set(['cashier']);
const roleLabel = currentUser?.role === 'super_admin' ? 'Registrar' : currentUser?.role;
```

Use `STAFF_DRAFT_ROLES` for draft create/edit/submit, `REGISTRAR_ROLES` for sign/anchor/claim QR/mark claimed, and no lifecycle actions for `developer`.

- [ ] **Step 2: Update row actions and bulk actions**

Keep submit available only for selected `draft` rows and staff/registrar users. Keep sign available only for selected `for_signature` rows and registrar users. Keep anchor available only for signed plus paid rows and registrar users. Keep claim QR available after signed plus paid, even when `anchorStatus` is not `anchored`.

- [ ] **Step 3: Lock submitted and signed content in UI**

Change UI edit eligibility to:

```js
const canEditCredentialDraft = (draft) => {
  if (hasIssuedCredentialArtifacts(draft)) return false;
  return draft?.status === 'draft';
};
```

Show submitted/signed rows as read-only and avoid cashier-specific denial text for non-cashier roles.

- [ ] **Step 4: Make cashier payment modal authoritative to the user**

Keep the selector labels `Default Anchor` and `Anchor Now`, update the displayed amount to match the selected mode, and add the scheduled preview text using existing pricing/settings data:

```jsx
<p className="text-xs text-slate-500">
  {anchorMode === 'anchor_now'
    ? 'Anchor will be queued for today after registrar signing is complete.'
    : 'Anchor will follow the default batch schedule after registrar signing is complete.'}
</p>
```

- [ ] **Step 5: Keep anchor tab useful before processing**

Build anchor tab rows from credentials with `anchorStatus === 'queued'`, `anchorStatus === 'merkle_ready'`, `status === 'queued_for_anchor'`, or `status === 'anchored'`. Display scheduled/default versus same-day anchor mode and keep process buttons registrar-only.

- [ ] **Step 6: Run web checks**

Run:

```powershell
cd client
npm.cmd run build
npm.cmd run validate:routes
npm.cmd run lint
```

Expected: build and route validation pass; lint has no new errors.

### Task 4: Mobile Registration and Verification Submission

**Files:**
- Modify: `Mobile/app/(auth)/register.jsx`
- Modify: `Mobile/app/verification/account.jsx`
- Modify: `Mobile/services/verificationService.js`
- Modify: `server/src/modules/verification/controller.js`
- Modify: `server/src/modules/verification/submissionPayload.js`
- Test: existing mobile validation scripts and backend verification tests if present

- [ ] **Step 1: Simplify registration**

Keep only:

```js
const [form, setForm] = useState({
  email: '',
  password: '',
  confirmPassword: '',
});
```

Submit the same payload keys the auth endpoint expects for these fields. Remove full name, address, student ID, program, year level, username, and contact inputs from the registration screen.

- [ ] **Step 2: Remove Account as a verification step**

Use:

```js
const STEPS = ['Personal Info', 'Valid ID', 'Liveness Check', 'Review'];
```

Add a submit state in the footer/button area rather than a fifth account step. The first visible verification section should collect personal information.

- [ ] **Step 3: Remove separate liveness image upload**

Delete local state and UI references named `livenessImage`, `selfieProof`, `Live proof photo`, or `Liveness proof`. Keep FaceVerifier and store metadata after successful face verification:

```js
setLivenessResult({
  passed: true,
  method: 'face_verifier',
  checkedAt: new Date().toISOString(),
});
```

- [ ] **Step 4: Submit liveness metadata instead of image file**

Change `Mobile/services/verificationService.js` to send `livenessPassed`, `livenessMethod`, and `livenessCheckedAt`. Keep `idFront` and `idBack` file uploads.

```js
formData.append('livenessPassed', String(Boolean(liveness?.passed)));
formData.append('livenessMethod', liveness?.method || 'face_verifier');
formData.append('livenessCheckedAt', liveness?.checkedAt || new Date().toISOString());
```

- [ ] **Step 5: Accept metadata on the backend**

In `submissionPayload.js`, require a truthy metadata value instead of a liveness image:

```js
if (!body.livenessPassed && body.livenessPassed !== true) {
  throw validationError('Liveness verification is required.');
}
```

Persist metadata on the submission if the model already has a flexible object field; otherwise add `livenessPassed`, `livenessMethod`, and `livenessCheckedAt` fields to the verification model using optional defaults.

- [ ] **Step 6: Run mobile and backend checks**

Run:

```powershell
cd Mobile
npm.cmd run validate:config
npm.cmd run validate:qr
npm.cmd run validate:server-config
npx.cmd expo config --type public
npm.cmd run lint
cd ..\server
npm.cmd test
```

Expected: all validation scripts pass and no liveness image strings remain in active mobile verification code.

### Task 5: Verifier Pending-Anchor Result Semantics

**Files:**
- Modify: verifier result service files found by `rg "anchoredOnChain|anchorStatus|signatureValid|credentialConfirmed" server/src client/src Mobile`
- Test: existing verifier tests if present

- [ ] **Step 1: Locate verifier result computation**

Run:

```powershell
rg "anchoredOnChain|anchorStatus|signatureValid|credentialConfirmed|payloadVerified" server/src client/src Mobile
```

- [ ] **Step 2: Update result semantics**

Return or derive these fields:

```js
{
  signatureValid: true,
  credentialConfirmed: true,
  anchorStatus: credential.anchorStatus || 'not_requested',
  anchoredOnChain: credential.anchorStatus === 'anchored',
}
```

Use warning or pending copy for `anchorStatus !== 'anchored'`; do not mark the credential invalid solely because anchoring is pending.

- [ ] **Step 3: Validate verifier display**

Run web build and lint after UI changes. Search for rejection copy that treats unanchored but signed credentials as invalid and replace it with pending-anchor wording.

### Task 6: Final Regression and Static Searches

**Files:**
- No new files expected beyond focused tests and this plan

- [ ] **Step 1: Run required validation**

Run:

```powershell
cd server
npm.cmd test
cd ..\client
npm.cmd run build
npm.cmd run validate:routes
npm.cmd run lint
cd ..\Mobile
npm.cmd run validate:config
npm.cmd run validate:qr
npm.cmd run validate:server-config
npx.cmd expo config --type public
npm.cmd run lint
cd ..
git diff --check
rg "https://psau-credentials\\.cfd/api"
rg "livenessImage|selfieProof|Live proof photo|Liveness proof"
rg "cashier" client/src/features/credentials server/src/modules/credentials
```

- [ ] **Step 2: Inspect static search results**

Expected:
- `rg "https://psau-credentials\\.cfd/api"` returns no matches.
- The liveness search returns no active mobile liveness-proof upload copy or state.
- The cashier search only shows payment-specific behavior and denial text that genuinely applies to cashier-only cases.

- [ ] **Step 3: Summarize changed behavior**

Report the exact validation commands and results. Mention any pre-existing lint warnings separately from new issues.

---

## Self-Review

**Spec coverage:** The plan covers role mapping, backend authoritative permissions, draft-only editing, registrar signing, cashier anchor selector persistence, signed-plus-paid claim QR eligibility, anchor queue behavior, web bulk/action hiding, mobile registration simplification, mobile verification step changes, liveness image removal, verifier pending-anchor semantics, and requested validation/search commands.

**Placeholder scan:** The plan does not use TBD/TODO/fill-in placeholders. Each task names concrete files, status values, commands, and expected behavior.

**Type consistency:** Role values remain stored as `admin`, `super_admin`, `developer`, and `cashier`. UI display may label `super_admin` as Registrar, but backend payloads and guards continue using `super_admin`.
