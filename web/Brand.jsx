import React from 'react';
import {HStack} from '@astryxdesign/core/HStack';
import {Text} from '@astryxdesign/core/Text';
// A play sail above a boat hull: LibreStream's requested ship/video mark.
export function Brand() {
 return <HStack gap={2} className="brand-lockup"><svg className="brand-mark" viewBox="0 0 40 40" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"><path d="M18 5v21M22 7l12 9-12 7Z"/><path d="M7 26h28l-5 8H12Z"/><path d="M5 37c3-2 5 2 8 0s5 2 8 0 5 2 8 0 5 2 8 0"/></svg><Text type="label">LibreStream</Text></HStack>;
}
