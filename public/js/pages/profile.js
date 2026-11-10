// @ts-check
// Profil (dizayn 3a) va Organizer arizasi (3b–3e).
// GET/PATCH /users/me, GET/POST /users/organizer-applications[/me].

import { api, ApiError } from '../api.js';
import { requireUser } from '../session.js';
import { mountNav, mountFooter } from '../shell.js';
import * as v from '../validate.js';
import {
  $,
  h,
  showError,
  showLoading,
  setFieldError,
  validateFields,
  clearErrorsOnInput,
  withBusy,
  errorMessage,
} from '../ui.js';

/** @typedef {import('../types.js').User} User */
/** @typedef {import('../types.js').OrganizerApplication} OrganizerApplication */

const content = $('content');
void mountNav($('topnav'), 'profile');
mountFooter($('footer'));
void load();

async function load() {
  const user = await requireUser();
  showLoading(content);
  const profile = profileCard(user);
  if (user.role !== 'CUSTOMER' && user.role !== 'ORGANIZER') {
    content.replaceChildren(profile);
    return;
  }
  const organizer = h('section', {
    class: 'pframe',
    'aria-labelledby': 'org-title',
  });
  content.replaceChildren(profile, organizer);
  await renderOrganizer(organizer, user);
}

// ---------- Profil ----------

/** @param {User} user */
function profileCard(user) {
  const nameInput = h('input', {
    class: 'input',
    id: 'fullName',
    autocomplete: 'name',
    value: user.fullName ?? '',
  });
  const saveButton = h('button', {
    class: 'btn btn-primary btn-block',
    type: 'submit',
    text: 'Saqlash',
  });
  const saved = h('p', { class: 'saved', role: 'status', hidden: true });
  const profileForm = h(
    'form',
    { novalidate: true },
    h(
      'div',
      { class: 'field' },
      h('label', { for: 'fullName', text: "To'liq ism" }),
      nameInput,
    ),
    h(
      'div',
      { class: 'field' },
      h('label', { for: 'email', text: 'Email' }),
      h('input', {
        class: 'input',
        id: 'email',
        value: user.email,
        disabled: true,
      }),
    ),
    saveButton,
    saved,
  );

  profileForm.addEventListener('submit', (event) => {
    event.preventDefault();
    saved.hidden = true;
    if (!validateFields([[nameInput, v.fullName]])) return;
    void withBusy(
      saveButton,
      async () => {
        try {
          await api.users.updateMe({ fullName: nameInput.value.trim() });
          user.fullName = nameInput.value.trim();
          saved.textContent = 'Saqlandi';
          saved.hidden = false;
        } catch (error) {
          setFieldError(nameInput, errorMessage(error));
        }
      },
      'Saqlanmoqda…',
    );
  });
  clearErrorsOnInput(profileForm);

  // Backend joriy parolni tekshirmaydi (PATCH /users/me), shuning uchun yangi parol ikki marta so'raladi
  const pass = h('input', {
    class: 'input',
    id: 'new-password',
    type: 'password',
    autocomplete: 'new-password',
  });
  const repeat = h('input', {
    class: 'input',
    id: 'repeat-password',
    type: 'password',
    autocomplete: 'new-password',
  });
  const passButton = h('button', {
    class: 'btn btn-secondary btn-block',
    type: 'submit',
    text: 'Parolni yangilash',
  });
  const passSaved = h('p', { class: 'saved', role: 'status', hidden: true });
  const passForm = h(
    'form',
    { novalidate: true },
    h('h4', { style: 'margin:0 0 14px', text: "Parolni o'zgartirish" }),
    h(
      'div',
      { class: 'field' },
      h('label', { for: 'new-password', text: 'Yangi parol' }),
      pass,
    ),
    h(
      'div',
      { class: 'field' },
      h('label', { for: 'repeat-password', text: 'Yangi parolni takrorlang' }),
      repeat,
    ),
    passButton,
    passSaved,
  );

  passForm.addEventListener('submit', (event) => {
    event.preventDefault();
    passSaved.hidden = true;
    const ok = validateFields([
      [pass, v.strongPassword],
      [
        repeat,
        (value) => (value === pass.value ? null : 'Parollar mos kelmadi'),
      ],
    ]);
    if (!ok) return;
    void withBusy(
      passButton,
      async () => {
        try {
          // fullName backend DTO'da majburiy
          await api.users.updateMe({
            fullName: user.fullName || nameInput.value.trim() || user.email,
            password: pass.value,
          });
          passForm.reset();
          passSaved.textContent = 'Parol yangilandi';
          passSaved.hidden = false;
        } catch (error) {
          setFieldError(pass, errorMessage(error));
        }
      },
      'Yangilanmoqda…',
    );
  });
  clearErrorsOnInput(passForm);

  return h(
    'section',
    { class: 'pframe', 'aria-labelledby': 'profile-title' },
    h('h3', { id: 'profile-title', text: 'Profil' }),
    profileForm,
    h('hr'),
    passForm,
  );
}

// ---------- Organizer arizasi ----------

/** @param {HTMLElement} target @param {User} user */
async function renderOrganizer(target, user) {
  const title = h('h3', { id: 'org-title', text: "Organizer bo'lish" });
  target.replaceChildren(
    title,
    h(
      'div',
      { class: 'state', role: 'status' },
      h('div', { class: 'spinner' }),
    ),
  );

  /** @type {OrganizerApplication[]} */
  let applications;
  try {
    applications = await api.users.myApplications();
  } catch (error) {
    target.replaceChildren(title);
    const box = h('div');
    target.append(box);
    showError(box, error, () => void renderOrganizer(target, user));
    return;
  }
  const latest = [...applications].sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
  )[0];

  if (user.role === 'ORGANIZER' || latest?.status === 'APPROVED') {
    target.replaceChildren(
      title,
      statusCard(
        latest,
        'TASDIQLANDI',
        'tag tag-accent-2',
        h('p', {
          class: 'note',
          text: 'Tabriklaymiz! Endi tadbirlar yaratishingiz mumkin.',
        }),
      ),
    );
  } else if (latest?.status === 'PENDING') {
    target.replaceChildren(
      title,
      statusCard(
        latest,
        'KUTILMOQDA',
        'badge b-pending',
        h('p', {
          class: 'note',
          text: "Arizangiz ko'rib chiqilmoqda. Odatda 1-2 ish kuni davom etadi.",
        }),
      ),
    );
  } else if (latest?.status === 'REJECTED') {
    const again = h('button', {
      class: 'btn btn-primary btn-block',
      type: 'button',
      style: 'margin-top:16px',
      text: 'Qayta ariza berish',
    });
    again.addEventListener('click', () =>
      target.replaceChildren(title, applicationForm(target, user, latest)),
    );
    target.replaceChildren(
      title,
      statusCard(
        latest,
        'RAD ETILDI',
        'badge b-err',
        latest.rejectReason
          ? h('div', { class: 'reason', text: `Sabab: ${latest.rejectReason}` })
          : null,
        again,
      ),
    );
  } else {
    target.replaceChildren(title, applicationForm(target, user, null));
  }
}

/**
 * @param {OrganizerApplication | undefined} app
 * @param {string} label
 * @param {string} cls
 * @param {...(Node | null)} extra
 */
function statusCard(app, label, cls, ...extra) {
  return h(
    'div',
    { class: 'card2' },
    h('span', { class: cls, text: label }),
    app ? h('h4', { text: app.companyName }) : null,
    app ? h('p', { class: 'phone', text: app.phone }) : null,
    ...extra,
  );
}

/**
 * @param {HTMLElement} target
 * @param {User} user
 * @param {OrganizerApplication | null} previous  qayta ariza uchun oldingi qiymatlar
 */
function applicationForm(target, user, previous) {
  const company = h('input', {
    class: 'input',
    id: 'company',
    autocomplete: 'organization',
    value: previous?.companyName ?? '',
  });
  const phone = h('input', {
    class: 'input',
    id: 'phone',
    type: 'tel',
    autocomplete: 'tel',
    inputmode: 'tel',
    placeholder: '+998 90 123 45 67',
    value: previous?.phone ?? '',
  });
  const description = h('textarea', {
    class: 'input',
    id: 'description',
    rows: '4',
  });
  description.value = previous?.description ?? '';
  const submit = h('button', {
    class: 'btn btn-primary btn-block',
    type: 'submit',
    text: 'Arizani yuborish',
  });
  const formError = h('p', {
    class: 'field-error',
    role: 'alert',
    hidden: true,
  });

  const form = h(
    'form',
    { novalidate: true },
    h('p', {
      class: 'intro',
      text: 'Tadbirlar tashkil qilish uchun ariza yuboring',
    }),
    h(
      'div',
      { class: 'field' },
      h('label', { for: 'company', text: 'Kompaniya nomi' }),
      company,
    ),
    h(
      'div',
      { class: 'field' },
      h('label', { for: 'phone', text: 'Telefon' }),
      phone,
    ),
    h(
      'div',
      { class: 'field' },
      h('label', { for: 'description', text: 'Tavsif' }),
      description,
    ),
    formError,
    submit,
  );

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    formError.hidden = true;
    const ok = validateFields([
      [company, v.required],
      [phone, v.uzPhone],
      [description, v.required],
    ]);
    if (!ok) return;
    void withBusy(
      submit,
      async () => {
        try {
          await api.users.apply({
            companyName: company.value.trim(),
            phone: v.normalizePhone(phone.value),
            description: description.value.trim(),
          });
          await renderOrganizer(target, user);
        } catch (error) {
          if (error instanceof ApiError && error.status === 409) {
            setFieldError(phone, error.message);
            phone.focus();
            return;
          }
          formError.textContent = errorMessage(error);
          formError.hidden = false;
        }
      },
      'Yuborilmoqda…',
    );
  });
  clearErrorsOnInput(form);
  return form;
}
