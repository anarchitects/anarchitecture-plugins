// SPDX-License-Identifier: MIT
import { usePackedPlugin } from '../packed-plugin';
import { assertNativeMembers } from '../native-members-consumer';

const suite = usePackedPlugin();
it('validates native esm members', () => assertNativeMembers(suite, 'esm'));
