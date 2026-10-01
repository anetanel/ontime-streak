// Hebrew verbs/adjectives are gendered. The admin's own gender is a setting
// (settings.gender); a guest's is chosen per invite and copied onto their
// grant. Both default to feminine, which is what the app used before this.
export function normalizeGender(gender) {
  return gender === "m" ? "m" : "f";
}

export function pick(gender, masculine, feminine) {
  return normalizeGender(gender) === "m" ? masculine : feminine;
}

// Static markup can carry both forms: <span data-m="..." data-f="...">.
export function applyGenderText(root, gender) {
  root.querySelectorAll("[data-m][data-f]").forEach((el) => {
    el.textContent = pick(gender, el.dataset.m, el.dataset.f);
  });
}
