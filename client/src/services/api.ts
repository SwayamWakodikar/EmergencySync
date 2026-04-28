import axios from 'axios';

const BASE_URL = 'https://emergencysync-3.onrender.com';

const api = axios.create({
    baseURL: BASE_URL,
});

export interface Ambulance {
    id: number;
    latitude: number;
    longitude: number;
    status: 'FREE' | 'ASSIGNED';
    type: 'AMBULANCE' | 'POLICE' | 'FIRE';
}

export interface Emergency {
    id: number;
    latitude: number;
    longitude: number;
    status: 'WAITING' | 'ASSIGNED' | 'COMPLETED';
    severity: number;
    description?: string;
    type: string;
    types_needed?: string[];
    action_plan?: string;
}

export interface Assignment {
    id: number;
    ambulance_id: number;
    emergency_id: number;
    assigned_at: string;
}

export const getAmbulances = async (): Promise<Ambulance[]> => {
    const { data } = await api.get<Ambulance[]>('/ambulances');
    return data;
};

export const getEmergencies = async (): Promise<Emergency[]> => {
    const { data } = await api.get<Emergency[]>('/emergencies');
    return data;
};

export const getAssignments = async (): Promise<Assignment[]> => {
    const { data } = await api.get<Assignment[]>('/assignments');
    return data;
};

export const createEmergency = async (description: string, location?: {latitude: number, longitude: number}): Promise<void> => {
    try {
        await api.post('/emergency', { description, ...location });
    } catch (err: any) {
        if (err.response && err.response.data && err.response.data.error) {
            throw new Error(err.response.data.error);
        }
        throw err;
    }
};

export const pingServer = async (): Promise<void> => {
    await api.get('/');
};

export default api;
