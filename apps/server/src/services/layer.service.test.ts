import { describe, test, expect } from "bun:test";
import { layerService } from "./layer.service";

describe("LayerService", () => {
  describe("canonicalizeUrl", () => {
    test("should remove hash fragments", () => {
      const url = "https://example.com/page#section";
      const result = layerService.canonicalizeUrl(url);
      expect(result).toBe("https://example.com/page");
    });

    test("should remove tracking parameters", () => {
      const url = "https://example.com/page?utm_source=twitter&utm_medium=social&normal=keep";
      const result = layerService.canonicalizeUrl(url);
      expect(result).toBe("https://example.com/page?normal=keep");
    });

    test("should sort query parameters", () => {
      const url = "https://example.com/page?z=last&a=first&m=middle";
      const result = layerService.canonicalizeUrl(url);
      expect(result).toBe("https://example.com/page?a=first&m=middle&z=last");
    });

    test("should handle URLs with no query params", () => {
      const url = "https://example.com/page";
      const result = layerService.canonicalizeUrl(url);
      expect(result).toBe("https://example.com/page");
    });

    test("should remove all tracking params and sort remaining", () => {
      const url = "https://example.com/page?utm_campaign=test&z=last&fbclid=123&a=first&gclid=456";
      const result = layerService.canonicalizeUrl(url);
      expect(result).toBe("https://example.com/page?a=first&z=last");
    });

    test("should handle complex URLs", () => {
      const url = "https://example.com/path/to/page?utm_source=email&b=2&a=1&msclkid=789#top";
      const result = layerService.canonicalizeUrl(url);
      expect(result).toBe("https://example.com/path/to/page?a=1&b=2");
    });
  });
});
