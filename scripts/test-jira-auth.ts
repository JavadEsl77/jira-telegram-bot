/**
 * Temporary diagnostic script — do not commit TEST_JIRA_TOKEN to version control.
 *
 * Add to .env:
 *   TEST_JIRA_TOKEN=<your PAT>
 *   TEST_JIRA_USERNAME=<your Jira username>  (optional, for Basic Auth test)
 *
 * Run:
 *   npx tsx scripts/test-jira-auth.ts
 */
import "dotenv/config";
import axios from "axios";

function maskToken(token: string): string {
    return token.length > 4 ? `${"*".repeat(8)}` : "****";
}

function safeBody(data: unknown): string {
    const raw = typeof data === "object" ? JSON.stringify(data) : String(data);
    return raw.slice(0, 300);
}

async function testAuth(
    label: string,
    baseURL: string,
    token: string,
    username?: string,
) {
    console.log(`\n--- ${label} ---`);
    if (username) console.log(`username: ${username}`);
    console.log(`token:    ${maskToken(token)}`);

    const headers: Record<string, string> = { Accept: "application/json" };
    const axiosConfig: Parameters<typeof axios.get>[1] = {
        headers,
        timeout: 15_000,
        validateStatus: () => true,
    };

    if (username) {
        axiosConfig.auth = { username, password: token };
    } else {
        headers["Authorization"] = `Bearer ${token}`;
    }

    try {
        const res = await axios.get(
            `${baseURL}/rest/api/2/myself`,
            axiosConfig,
        );

        console.log(`Status: ${res.status} ${res.statusText}`);

        if (res.status === 200) {
            const u = res.data as Record<string, unknown>;
            console.log("✅ Authentication successful");
            console.log(`  name:         ${u["name"] ?? "(not present)"}`);
            console.log(`  displayName:  ${u["displayName"] ?? "(not present)"}`);
            console.log(`  emailAddress: ${u["emailAddress"] ?? "(not present)"}`);
            console.log(`  key:          ${u["key"] ?? "(not present)"}`);
        } else if (res.status === 401) {
            console.log("❌ 401 Unauthorized — credentials rejected by Jira");
            console.log(`   Body: ${safeBody(res.data)}`);
        } else if (res.status === 403) {
            console.log("⚠️  403 Forbidden — authenticated but permission denied");
            console.log(`   Body: ${safeBody(res.data)}`);
        } else if (res.status === 404) {
            console.log("❌ 404 Not Found — API endpoint not reachable");
        } else if (res.status >= 500) {
            console.log(`❌ ${res.status} Server Error — Jira internal problem`);
            console.log(`   Body: ${safeBody(res.data)}`);
        } else {
            console.log(`Unexpected status. Body: ${safeBody(res.data)}`);
        }
    } catch (err: unknown) {
        if (axios.isAxiosError(err)) {
            console.log(`❌ Network error: ${err.message}`);
            if (err.code) console.log(`   Code: ${err.code}`);
        } else {
            console.log(`❌ Unknown error: ${err instanceof Error ? err.message : String(err)}`);
        }
    }
}

async function main() {
    const baseURL = process.env.JIRA_BASE_URL;
    const token = process.env.TEST_JIRA_TOKEN;
    const username = process.env.TEST_JIRA_USERNAME ?? process.env.JIRA_USERNAME;

    if (!baseURL) {
        console.error("Missing JIRA_BASE_URL in .env");
        process.exit(1);
    }
    if (!token) {
        console.error(
            "Missing TEST_JIRA_TOKEN in .env\n" +
            "Add: TEST_JIRA_TOKEN=<your Personal Access Token>",
        );
        process.exit(1);
    }

    console.log(`Jira base URL: ${baseURL}`);
    console.log("Endpoint:      /rest/api/2/myself");

    // Test 1: Bearer Token — correct for Jira Server/DC PAT
    await testAuth("Test 1: Bearer Token (correct for Jira Server PAT)", baseURL, token);

    // Test 2: Basic Auth with username — current JiraClient implementation
    if (username) {
        await testAuth("Test 2: Basic Auth username:PAT (current implementation)", baseURL, token, username);
    } else {
        console.log("\n--- Test 2: Basic Auth skipped (no username in env) ---");
    }

    console.log("\n---\nDone.");
}

main().catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
});
