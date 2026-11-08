import test from "node:test";
import assert from "node:assert/strict";
import { hashAccountPassword, verifyAccountPassword } from "../functions/api/_account.js";

test("account passwords are salted and verified without storing plaintext", async () => {
 const first=await hashAccountPassword("a-long-example-password");
 const second=await hashAccountPassword("a-long-example-password");
 assert.notEqual(first.salt,second.salt);
 assert.notEqual(first.hash,second.hash);
 assert.equal(await verifyAccountPassword("a-long-example-password",first.salt,first.hash),true);
 assert.equal(await verifyAccountPassword("a-different-password",first.salt,first.hash),false);
});
