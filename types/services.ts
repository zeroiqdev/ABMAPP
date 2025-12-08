export interface Service {
  id: string;
  key: string;
  title: string;
  description: string;
  pre_post_inspection?: boolean;
}

export interface ServiceSuggestion {
  id: string;
  key: string;
  title: string;
  serviceKey: string;
  followUpBadges?: string[];
}

export interface ServiceGroup {
  serviceKey: string;
  title: string;
  suggestions: ServiceSuggestion[];
}

export const AVAILABLE_SERVICES: Service[] = [
  {
    id: '1',
    key: 'general_service',
    title: 'General Service',
    description: 'Complete vehicle maintenance and inspection',
    pre_post_inspection: true,
  },
  {
    id: '2',
    key: 'oil_change',
    title: 'Oil Change',
    description: 'Engine oil and filter replacement',
  },
  {
    id: '3',
    key: 'brake_service',
    title: 'Brake Service',
    description: 'Brake pad replacement and brake fluid check',
    pre_post_inspection: true,
  },
  {
    id: '4',
    key: 'tire_service',
    title: 'Tire Service',
    description: 'Tire rotation, balancing, and replacement',
  },
  {
    id: '5',
    key: 'battery_service',
    title: 'Battery Service',
    description: 'Battery testing and replacement',
  },
  {
    id: '6',
    key: 'ac_service',
    title: 'AC Service',
    description: 'Air conditioning system maintenance',
  },
  {
    id: '7',
    key: 'engine_diagnosis',
    title: 'Engine Diagnosis',
    description: 'Engine problem diagnosis and repair',
    pre_post_inspection: true,
  },
  {
    id: '8',
    key: 'transmission_service',
    title: 'Transmission Service',
    description: 'Transmission fluid change and repair',
    pre_post_inspection: true,
  },
];

export const SERVICE_SUGGESTIONS: ServiceSuggestion[] = [
  {
    id: 's1',
    key: 'check_engine_light',
    title: 'Check Engine Light On',
    serviceKey: 'engine_diagnosis',
  },
  {
    id: 's2',
    key: 'strange_noise',
    title: 'Strange Noise',
    serviceKey: 'engine_diagnosis',
  },
  {
    id: 's3',
    key: 'overheating',
    title: 'Engine Overheating',
    serviceKey: 'engine_diagnosis',
  },
  {
    id: 's4',
    key: 'brake_squeaking',
    title: 'Brake Squeaking',
    serviceKey: 'brake_service',
    followUpBadges: ['Front Brakes', 'Rear Brakes'],
  },
  {
    id: 's5',
    key: 'brake_soft',
    title: 'Soft Brake Pedal',
    serviceKey: 'brake_service',
  },
  {
    id: 's6',
    key: 'low_brake_fluid',
    title: 'Low Brake Fluid',
    serviceKey: 'brake_service',
  },
  {
    id: 's7',
    key: 'oil_dirty',
    title: 'Dirty Engine Oil',
    serviceKey: 'oil_change',
  },
  {
    id: 's8',
    key: 'oil_leak',
    title: 'Oil Leak',
    serviceKey: 'oil_change',
  },
  {
    id: 's9',
    key: 'tire_wear',
    title: 'Uneven Tire Wear',
    serviceKey: 'tire_service',
  },
  {
    id: 's10',
    key: 'flat_tire',
    title: 'Flat Tire',
    serviceKey: 'tire_service',
  },
  {
    id: 's11',
    key: 'battery_dead',
    title: 'Battery Dead',
    serviceKey: 'battery_service',
  },
  {
    id: 's12',
    key: 'ac_not_cooling',
    title: 'AC Not Cooling',
    serviceKey: 'ac_service',
  },
];

export function getSuggestionsForServices(serviceKeys: string[]): ServiceGroup[] {
  const groups: { [key: string]: ServiceGroup } = {};

  SERVICE_SUGGESTIONS.forEach((suggestion) => {
    if (serviceKeys.includes(suggestion.serviceKey)) {
      if (!groups[suggestion.serviceKey]) {
        const service = AVAILABLE_SERVICES.find((s) => s.key === suggestion.serviceKey);
        groups[suggestion.serviceKey] = {
          serviceKey: suggestion.serviceKey,
          title: service?.title || suggestion.serviceKey,
          suggestions: [],
        };
      }
      groups[suggestion.serviceKey].suggestions.push(suggestion);
    }
  });

  return Object.values(groups);
}

