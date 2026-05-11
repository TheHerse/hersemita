function cleanNamePart(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 18);
}

export function makeAccessCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function makeRunnerUsername(firstName: string, lastName: string) {
  const last = cleanNamePart(lastName) || "runner";
  const firstInitial = cleanNamePart(firstName).slice(0, 1) || "x";
  const randomNumber = Math.floor(1000 + Math.random() * 9000).toString();

  return `${last}_${firstInitial}${randomNumber}`;
}
