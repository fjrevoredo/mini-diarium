import { Mark } from '@tiptap/core';

export const TimestampMark = Mark.create({
  name: 'timestamp',
  parseHTML() {
    return [{ tag: 'span.timestamp', getAttrs: () => ({}) }];
  },
  renderHTML() {
    return ['span', { class: 'timestamp' }, 0];
  },
});
