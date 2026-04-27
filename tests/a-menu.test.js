/* a-menu.test.js */

import ATestRunner from './ATestRunner.min.js';
import '../src/a-menu.js'; // Imports and defines the <a-menu> custom element

const runner = new ATestRunner(import.meta.url);
runner.output = "#test-results";

const {
  group,
  test,
  wait
} = runner;

group("A-Menu Initialization & Defaults", () => {
  const menu = document.createElement('a-menu');
  document.body.appendChild(menu);

  test("Element is defined", menu instanceof HTMLElement, true);
  test("Default type is 'classic'", menu.type, 'classic');
  test("Default open is false", () => {
    return menu.open
  }, false);

  test("Default breakpoint is 600", menu.breakpoint, 600);
  test("Default swipe is 40", menu.swipe, 40);
  test("Default top is true (if no parent a-menu)", menu.top, true);

  menu.remove();
});

group("A-Menu Properties & Attributes", () => {
  const menu = document.createElement('a-menu');
  document.body.appendChild(menu);

  test("Setting type reflects to attribute", () => {
    menu.type = 'dropdown';
    return menu.getAttribute('type');
  }, 'dropdown');

  test("Setting open updates shadow DOM details element", async () => {
    menu.open = true;
    await wait(10); // Wait a tick for DOM update
    return menu.shadowRoot.getElementById('menu').open;
  }, true);

  test("Setting breakpoint reflects to attribute", () => {
    menu.breakpoint = 800;
    return menu.getAttribute('breakpoint');
  }, '800');

  test("Setting debug reflects to attribute", async () => {
    menu.debug = true;
    const result = menu.hasAttribute('debug');
    menu.debug = false;
    return result;
  }, true);

  menu.remove();
});

group("A-Menu Group (Accordion) Behavior", () => {
  test("Opening one menu closes others in the same group", async () => {
    const m1 = document.createElement('a-menu');
    const m2 = document.createElement('a-menu');

    m1.group = 'test-group';
    m2.group = 'test-group';
    document.body.append(m1, m2);

    m1.open = true;
    await wait(10);

    m2.open = true;
    // Wait for transition end / fallback timeout (css duration is 400ms + 50ms buffer)
    await wait(500);

    const success = (m1.open === false && m2.open === true);

    m1.remove();
    m2.remove();
    return success;
  }, true);
});

runner.run();
