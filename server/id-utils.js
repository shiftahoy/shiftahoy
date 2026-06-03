const crypto = require("crypto");

const ACCOUNT_ID_PATTERN = /^\d{9}$/;

function normalizeAccountNumber(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 9);
}

function isValidAccountNumber(value) {
  return ACCOUNT_ID_PATTERN.test(String(value || ""));
}

function generateNineDigitAccountNumber() {
  return String(crypto.randomInt(100000000, 1000000000));
}

async function createUniqueBusinessAccountNumber(client, issuedTo = "business") {
  for (let attempt = 0; attempt < 250; attempt += 1) {
    const accountNumber = generateNineDigitAccountNumber();

    try {
      await client.query(
        `INSERT INTO issued_account_ids (account_number, issued_to)
         VALUES ($1, $2)`,
        [accountNumber, issuedTo]
      );
      return accountNumber;
    } catch (err) {
      if (err.code !== "23505") throw err;
    }
  }

  throw new Error("Unable to generate a unique 9 digit Business ID#. Please try again.");
}

async function createUniqueAccountNumber(client, issuedTo = "business") {
  return createUniqueBusinessAccountNumber(client, issuedTo);
}

module.exports = {
  ACCOUNT_ID_PATTERN,
  normalizeAccountNumber,
  isValidAccountNumber,
  createUniqueAccountNumber,
  createUniqueBusinessAccountNumber
};
