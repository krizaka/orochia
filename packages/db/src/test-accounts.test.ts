import { describe, expect, it } from "vitest";
import { testAccountsFromEnv } from "./test-accounts";

const today = new Date("2026-10-14T12:00:00Z");
const env = {
  AUTH_TEST_FAN_EMAIL: "qa+fan@orochia.com",
  AUTH_TEST_FAN_USERNAME: "qa_fan",
  AUTH_TEST_FAN_PASSWORD: "fan-password-123",
  AUTH_TEST_CREATOR_EMAIL: "qa+creator@orochia.com",
  AUTH_TEST_CREATOR_USERNAME: "qa_creator",
  AUTH_TEST_CREATOR_PASSWORD: "creator-password-123",
};

describe("the QA accounts injected from the environment", () => {
  it("describes one fan (MEMBER) and one creator (CREATOR), adults by default", () => {
    const [fan, creator] = testAccountsFromEnv(env, today);
    expect(fan).toMatchObject({ role: "MEMBER", email: "qa+fan@orochia.com", username: "qa_fan", dateOfBirth: "1990-01-01" });
    expect(creator).toMatchObject({ role: "CREATOR", email: "qa+creator@orochia.com", username: "qa_creator" });
  });

  it("refuses a missing or short password, and an account younger than 18", () => {
    expect(() => testAccountsFromEnv({ ...env, AUTH_TEST_FAN_PASSWORD: "" }, today)).toThrow(/AUTH_TEST_FAN_PASSWORD/);
    expect(() => testAccountsFromEnv({ ...env, AUTH_TEST_CREATOR_PASSWORD: "short" }, today)).toThrow(/12\+ characters/);
    expect(() => testAccountsFromEnv({ ...env, AUTH_TEST_DATE_OF_BIRTH: "2010-01-01" }, today)).toThrow(/18 or older/);
  });

  it("refuses the same e-mail or username for both accounts", () => {
    expect(() => testAccountsFromEnv({ ...env, AUTH_TEST_CREATOR_USERNAME: "qa_fan" }, today)).toThrow(/different/);
  });
});
