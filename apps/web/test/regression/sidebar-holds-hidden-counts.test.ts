import { describe, expect, it } from 'vitest';
import { phoneStyle } from './phoneCss';

// PT-115: each project in the desktop sidebar says its count to screen readers in a visually
// hidden span, which is positioned absolutely. The sidebar scrolls its projects but wasn't
// positioned, so those spans escaped its scroller: with more projects than it shows, the page
// grew taller than the window (1178px at 1280×800 with 31 projects), and focusing a board card
// scrolled the whole app up by 114px, leaving an empty strip under the sidebar and the content.

const DESKTOP_WIDTH = 1280;

describe("regression: the sidebar keeps its projects' hidden counts inside it", () => {
  it('is the box its absolutely positioned content is placed in', () => {
    const sidebar = document.createElement('aside');
    sidebar.className = 'sidebar';

    const style = phoneStyle(sidebar, 'app/Sidebar.module.css', DESKTOP_WIDTH);

    expect(style.get('overflow-y')).toBe('auto');
    expect(style.get('position') ?? 'static').not.toBe('static');
  });
});
