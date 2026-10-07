// SPDX-License-Identifier: MIT
import { usePackedPlugin } from '../packed-plugin';
import { assertNativeMembers } from '../native-members-consumer';

const suite = usePackedPlugin();
it('validates native cjs members', () => assertNativeMembers(suite, 'cjs'));
