// SPDX-License-Identifier: MIT
import { usePackedPlugin } from '../packed-plugin';
import { assertNativeOwners } from '../native-owners-consumer';

const suite = usePackedPlugin();
it('validates native esm owners', () => assertNativeOwners(suite, 'esm'));
