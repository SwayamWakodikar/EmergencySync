import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const api = axios.create({
    baseURL: BASE_URL,
    timeout: 8000,
});

export interface Ambulance {
    id: number;
    latitude: number;
    longitude: number;
    status: 'FREE' | 'ASSIGNED';
}

export interface Emergency {
    id: number;
    latitude: number;
    longitude: number;
    status: 'WAITING' | 'ASSIGNED' | 'COMPLETED';
    severity: number;
    description?: string;
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

export const createEmergency = async (description: string): Promise<void> => {
    await api.post('/emergency', { description });
};

export default api;
