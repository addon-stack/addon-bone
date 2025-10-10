type Tab = chrome.tabs.Tab;
type CreateProperties = chrome.tabs.CreateProperties;

import CaptureInfo = chrome.tabCapture.CaptureInfo;

class TabService {
    public create(properties: CreateProperties): Promise<Tab> {
        return chrome.tabs.create(properties);
    }

    public get(): Promise<Tab[]> {
        return chrome.tabs.query({});
    }

    public tab(): Tab | undefined {
        return;
    }

    public async remove(tabId: number): Promise<void> {
        await chrome.tabs.remove(tabId);
    }

    public async update(tab: chrome.tabs.Tab, properties: chrome.tabs.CreateProperties): Promise<void> {
        await chrome.tabs.update(tab.id!, properties);
    }

    public captureInfo(): CaptureInfo {
        return {
            tabId: 1,
            status: 'active',
            fullscreen: false,
        };
    }
}

export default () => {
    return new TabService();
};