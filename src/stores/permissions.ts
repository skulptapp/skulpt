import { create } from 'zustand';
import { produce } from 'immer';
import { dset as dmerge } from 'dset/merge';
import { RESULTS } from 'react-native-permissions';

type ValueOf<T> = T[keyof T];

type Permissions = {
    camera?: ValueOf<typeof RESULTS>;
    microphone?: ValueOf<typeof RESULTS>;
    tracking?: ValueOf<typeof RESULTS>;
    notifications?: ValueOf<typeof RESULTS>;
};

type State = {
    permissions: Permissions;
};

type Actions = {
    setPermissions: (permissions: Permissions) => void;
};

const initial: State = {
    permissions: {},
};

export const usePermissionsStore = create<State & Actions>()((set) => ({
    ...initial,
    setPermissions: (permissions) =>
        set(
            produce((state) => {
                dmerge(state, 'permissions', permissions);
            }),
        ),
}));
