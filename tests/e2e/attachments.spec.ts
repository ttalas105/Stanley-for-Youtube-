import { expect, test } from "@playwright/test";
import { buildPayload, mockGeneration, openApp } from "./fixtures";

test("opens the vidIQ-style attachment menu", async ({ page }) => {
  await openApp(page);
  const add = page.getByRole("button", { name: "Add attachment" });
  await add.click();

  const menu = page.getByRole("menu", { name: "Add to your message" });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("menuitem")).toHaveCount(3);
  await expect(menu).toContainText("Attach an image");
  await expect(menu).toContainText("Attach a video");
  await expect(menu).toContainText("Add from YouTube");
});

test("uploads an image and sends it to the model request", async ({ page }) => {
  let submitted: { attachments?: Array<{ kind: string; mimeType: string; data: string }> } | undefined;
  await mockGeneration(page, {
    handler: async (route) => {
      submitted = route.request().postDataJSON() as typeof submitted;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(buildPayload()) });
    },
  });
  await openApp(page);

  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
  await page.getByLabel("Upload images").setInputFiles({ name: "rough-thumbnail.png", mimeType: "image/png", buffer: png });
  await expect(page.getByLabel("Attached references")).toContainText("rough-thumbnail.png");

  await page.getByLabel("Message Stanley").fill("Build a stronger thumbnail concept from this rough image.");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.locator(".user-message-attachments")).toContainText("rough-thumbnail.png");
  expect(submitted?.attachments?.[0].kind).toBe("image");
  expect(submitted?.attachments?.[0].mimeType).toBe("image/png");
  expect(submitted?.attachments?.[0].data.length).toBeGreaterThan(20);
});

test("uploads a short video and sends it as multimodal context", async ({ page }) => {
  let submitted: { attachments?: Array<{ kind: string; mimeType: string; data: string }> } | undefined;
  await mockGeneration(page, {
    handler: async (route) => {
      submitted = route.request().postDataJSON() as typeof submitted;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(buildPayload()) });
    },
  });
  await openApp(page);

  const fakeMp4 = Buffer.from("00000018667479706d703432000000006d70343269736f6d", "hex");
  await page.getByLabel("Upload video").setInputFiles({ name: "opening-hook.mp4", mimeType: "video/mp4", buffer: fakeMp4 });
  await expect(page.getByLabel("Attached references")).toContainText("opening-hook.mp4");
  await page.getByLabel("Message Stanley").fill("Build a title and hook that match this opening clip.");
  await page.getByRole("button", { name: "Send message" }).click();

  expect(submitted?.attachments?.[0].kind).toBe("video");
  expect(submitted?.attachments?.[0].mimeType).toBe("video/mp4");
  expect(submitted?.attachments?.[0].data.length).toBeGreaterThan(20);
});

test("chooses a video from the connected YouTube channel", async ({ page }) => {
  const profile = {
    id: "channel-1",
    title: "Thomas Tests",
    thumbnailUrl: "",
    subscriberCount: 25,
    videoCount: 4,
    totalViews: 1200,
    analyzedAt: new Date().toISOString(),
  };
  await page.route("**/api/youtube/status", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ configured: true, connected: true, profile }),
  }));
  await page.route("**/api/youtube/videos", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ videos: [{
      id: "video-abc123",
      title: "My 30 day creator experiment",
      thumbnailUrl: "https://i.ytimg.com/vi/video-abc123/mqdefault.jpg",
      publishedAt: "2026-07-01T12:00:00Z",
      views: 4200,
      duration: "PT8M12S",
      privacyStatus: "public",
      url: "https://www.youtube.com/watch?v=video-abc123",
    }] }),
  }));
  const submissions: Array<{ attachments?: Array<{ kind: string; videoId: string; title: string; thumbnailUrl: string }> }> = [];
  await mockGeneration(page, {
    handler: async (route) => {
      submissions.push(route.request().postDataJSON() as typeof submissions[number]);
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(buildPayload()) });
    },
  });
  await openApp(page);

  await page.getByRole("button", { name: "Add attachment" }).click();
  await page.getByRole("menuitem", { name: /Add from YouTube/ }).click();
  const picker = page.getByRole("dialog", { name: "Select a reference video" });
  await expect(picker).toBeVisible();
  await picker.getByRole("button", { name: /My 30 day creator experiment/ }).click();
  await picker.getByRole("button", { name: "Add video" }).click();
  await expect(page.getByLabel("Attached references")).toContainText("My 30 day creator experiment");

  await page.getByLabel("Message Stanley").fill("Give me three follow-up video ideas based on this upload.");
  await page.getByRole("button", { name: "Send message" }).click();
  expect(submissions[0]?.attachments?.[0]).toMatchObject({
    kind: "youtube",
    videoId: "video-abc123",
    title: "My 30 day creator experiment",
    thumbnailUrl: "https://i.ytimg.com/vi/video-abc123/mqdefault.jpg",
  });

  await expect(page.locator(".assistant-option")).toHaveCount(12);
  await page.getByLabel("Message Stanley").fill("What else stands out about that same video?");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.locator(".user-message")).toHaveCount(2);
  expect(submissions[1]?.attachments?.[0]).toMatchObject({
    kind: "youtube",
    videoId: "video-abc123",
    title: "My 30 day creator experiment",
    thumbnailUrl: "https://i.ytimg.com/vi/video-abc123/mqdefault.jpg",
  });

  await page.getByLabel("Message Stanley").fill("I have a new idea about building an AI tool in 7 days. Let's build the idea.");
  await page.getByRole("button", { name: "Send message" }).click();
  expect(submissions[2]?.attachments || []).toHaveLength(0);
});

test("keeps owner-visible private and unlisted uploads in the YouTube picker", async ({ page }) => {
  const profile = {
    id: "channel-1",
    title: "Thomas Tests",
    thumbnailUrl: "",
    subscriberCount: 25,
    videoCount: 4,
    totalViews: 1200,
    analyzedAt: new Date().toISOString(),
  };
  await page.route("**/api/youtube/status", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ configured: true, connected: true, captionAccess: true, profile }),
  }));
  await page.route("**/api/youtube/videos", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ videos: [
      {
        id: "private-abc123",
        title: "My private movie",
        thumbnailUrl: "https://i.ytimg.com/vi/private-abc123/mqdefault.jpg",
        publishedAt: "2026-07-01T12:00:00Z",
        views: 8,
        duration: "PT1M54S",
        privacyStatus: "private",
        url: "https://www.youtube.com/watch?v=private-abc123",
      },
      {
        id: "unlisted-abc123",
        title: "My unlisted movie",
        thumbnailUrl: "https://i.ytimg.com/vi/unlisted-abc123/mqdefault.jpg",
        publishedAt: "2026-07-02T12:00:00Z",
        views: 17,
        duration: "PT2M10S",
        privacyStatus: "unlisted",
        url: "https://www.youtube.com/watch?v=unlisted-abc123",
      },
      {
        id: "public-abc123",
        title: "My public movie",
        thumbnailUrl: "https://i.ytimg.com/vi/public-abc123/mqdefault.jpg",
        publishedAt: "2026-07-03T12:00:00Z",
        views: 21,
        duration: "PT2M30S",
        privacyStatus: "public",
        url: "https://www.youtube.com/watch?v=public-abc123",
      },
    ] }),
  }));
  await openApp(page);

  await page.getByRole("button", { name: "Add attachment" }).click();
  await page.getByRole("menuitem", { name: /Add from YouTube/ }).click();
  const picker = page.getByRole("dialog", { name: "Select a reference video" });
  await expect(picker.getByRole("button", { name: /My private movie/ })).toBeVisible();
  await expect(picker.getByRole("button", { name: /My unlisted movie/ })).toBeVisible();
  await expect(picker.getByRole("button", { name: /My public movie/ })).toBeVisible();
});

test("records a voice message and places the transcript in the composer", async ({ page }) => {
  await page.addInitScript(() => {
    const fakeTrack = { stop() {} };
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: async () => ({ getTracks: () => [fakeTrack] }) },
    });
    class FakeMediaRecorder extends EventTarget {
      static isTypeSupported() { return true; }
      state = "inactive";
      mimeType = "audio/webm";
      start() { this.state = "recording"; }
      stop() {
        this.state = "inactive";
        const event = new Event("dataavailable");
        Object.defineProperty(event, "data", { value: new Blob(["voice"], { type: "audio/webm" }) });
        this.dispatchEvent(event);
        this.dispatchEvent(new Event("stop"));
      }
    }
    Object.defineProperty(window, "MediaRecorder", { configurable: true, value: FakeMediaRecorder });
  });
  await page.route("**/api/transcribe", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ transcript: "Give me video ideas about training my dog Rudy" }),
  }));
  await openApp(page);

  await page.getByRole("button", { name: "Start voice message" }).click();
  await expect(page.getByRole("button", { name: "Stop recording" })).toBeVisible();
  await page.getByRole("button", { name: "Stop recording" }).click();
  await expect(page.getByLabel("Message Stanley")).toHaveValue("Give me video ideas about training my dog Rudy");
  await expect(page.getByRole("button", { name: "Send message" })).toBeEnabled();
});

test("types prompt ideas and leaves enough time to read each one", async ({ page }) => {
  await openApp(page);
  const prompt = page.locator(".typewriter-placeholder");
  const firstSuggestion = "Help me get more views on my next video";

  await expect(prompt).toBeVisible();
  await expect.poll(async () => (await prompt.textContent())?.length || 0, { timeout: 2200 }).toBeGreaterThan(8);
  await expect(prompt).toHaveText(firstSuggestion, { timeout: 3000 });
  await page.waitForTimeout(3000);
  await expect(prompt).toHaveText(firstSuggestion);
  await expect.poll(() => prompt.textContent(), { timeout: 5000 }).not.toBe(firstSuggestion);
});
