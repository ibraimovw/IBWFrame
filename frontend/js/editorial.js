export const EDITORIAL_COLLECTIONS = [
  {
    slug: 'acclaimed-modern-classics',
    titleEn: 'Critically Acclaimed Cinema',
    titleRu: 'Признанные шедевры кино',
    descEn: 'Highest-rated motion pictures celebrated by global audiences and critics.',
    descRu: 'Фильмы с самыми высокими оценками зрителей и критиков со всего мира.',
    toneClass: 'tone-crimson',
    discoverParams: {
      sort_by: 'vote_average.desc',
      'vote_count.gte': 4500,
      'vote_average.gte': 8.0,
    },
  },
  {
    slug: 'best-sci-fi',
    titleEn: 'Best Sci-Fi Visions',
    titleRu: 'Лучшая научная фантастика',
    descEn: 'Speculative worlds, cosmic odysseys, and cerebral futuristic storytelling.',
    descRu: 'Космические одиссеи, миры будущего и интеллектуальная фантастика.',
    toneClass: 'tone-blue',
    discoverParams: {
      with_genres: '878',
      sort_by: 'vote_average.desc',
      'vote_count.gte': 2500,
      'vote_average.gte': 7.5,
    },
  },
  {
    slug: 'greatest-thrillers',
    titleEn: 'Greatest Thrillers',
    titleRu: 'Выдающиеся триллеры',
    descEn: 'Relentless tension, sharp twists, and atmospheric suspense.',
    descRu: 'Напряжённые сюжеты, неожиданные повороты и мастерский саспенс.',
    toneClass: 'tone-violet',
    discoverParams: {
      with_genres: '53',
      sort_by: 'vote_average.desc',
      'vote_count.gte': 2500,
      'vote_average.gte': 7.5,
    },
  },
  {
    slug: 'hidden-gems',
    titleEn: 'Hidden Gems',
    titleRu: 'Скрытые жемчужины',
    descEn: 'Distinctive, high-scoring films outside the loudest mainstream circuits.',
    descRu: 'Яркие и высоко оценённые фильмы вне самого массового проката.',
    toneClass: 'tone-graphite',
    discoverParams: {
      sort_by: 'vote_average.desc',
      'vote_count.gte': 350,
      'vote_average.gte': 7.7,
      'primary_release_date.gte': '2000-01-01',
    },
  },
  {
    slug: 'action-classics',
    titleEn: 'Action Landmarks',
    titleRu: 'Классика экшена',
    descEn: 'Precision choreography, kinetic pacing, and iconic set pieces.',
    descRu: 'Безупречная хореография, динамика и культовые сцены.',
    toneClass: 'tone-crimson',
    discoverParams: {
      with_genres: '28',
      sort_by: 'vote_average.desc',
      'vote_count.gte': 3000,
      'vote_average.gte': 7.4,
    },
  },
];

export const EXPLORE_DECADES = [
  { id: '2020s', labelEn: '2020s', labelRu: '2020-е', gte: '2020-01-01', lte: '2029-12-31' },
  { id: '2010s', labelEn: '2010s', labelRu: '2010-е', gte: '2010-01-01', lte: '2019-12-31' },
  { id: '2000s', labelEn: '2000s', labelRu: '2000-е', gte: '2000-01-01', lte: '2009-12-31' },
  { id: '1990s', labelEn: '1990s', labelRu: '1990-е', gte: '1990-01-01', lte: '1999-12-31' },
  { id: '1980s', labelEn: '1980s', labelRu: '1980-е', gte: '1980-01-01', lte: '1989-12-31' },
  { id: '1970s', labelEn: '1970s', labelRu: '1970-е', gte: '1970-01-01', lte: '1979-12-31' },
];

export const EXPLORE_COUNTRIES = [
  { code: 'US', nameEn: 'United States', nameRu: 'США' },
  { code: 'GB', nameEn: 'United Kingdom', nameRu: 'Великобритания' },
  { code: 'FR', nameEn: 'France', nameRu: 'Франция' },
  { code: 'JP', nameEn: 'Japan', nameRu: 'Япония' },
  { code: 'KR', nameEn: 'South Korea', nameRu: 'Южная Корея' },
  { code: 'RU', nameEn: 'Russia', nameRu: 'Россия' },
  { code: 'IT', nameEn: 'Italy', nameRu: 'Италия' },
  { code: 'DE', nameEn: 'Germany', nameRu: 'Германия' },
];

export const EXPLORE_MOODS = [
  {
    id: 'mind-bending',
    titleEn: 'Mind-Bending & Cerebral',
    titleRu: 'Интеллектуальное и запутанное',
    descEn: 'Sci-fi mysteries and intricate narratives',
    descRu: 'Научная фантастика и многослойные загадки',
    params: { with_genres: '878,9648', 'vote_average.gte': 7.2, 'vote_count.gte': 1000, sort_by: 'vote_average.desc' },
  },
  {
    id: 'atmospheric-noir',
    titleEn: 'Crime & Neo-Noir',
    titleRu: 'Криминал и нео-нуар',
    descEn: 'Shadowy investigations and moral tension',
    descRu: 'Мрачные расследования и острая интрига',
    params: { with_genres: '80,53', 'vote_average.gte': 7.2, 'vote_count.gte': 1000, sort_by: 'popularity.desc' },
  },
  {
    id: 'warm-human',
    titleEn: 'Heartfelt & Uplifting',
    titleRu: 'Тёплое и вдохновляющее',
    descEn: 'Comedy-dramas and human stories',
    descRu: 'Душевные драмы и светлые комедии',
    params: { with_genres: '35,18', 'vote_average.gte': 7.3, 'vote_count.gte': 1000, sort_by: 'popularity.desc' },
  },
  {
    id: 'epic-odyssey',
    titleEn: 'Epic Adventures',
    titleRu: 'Масштабные приключения',
    descEn: 'Sweeping journeys and grand cinema',
    descRu: 'Грандиозные путешествия и зрелищное кино',
    params: { with_genres: '12,14', 'vote_average.gte': 7.0, 'vote_count.gte': 1500, sort_by: 'popularity.desc' },
  },
];

export const WATCH_REGIONS = [
  { code: 'US', nameEn: 'United States (US)', nameRu: 'США (US)' },
  { code: 'GB', nameEn: 'United Kingdom (GB)', nameRu: 'Великобритания (GB)' },
  { code: 'RU', nameEn: 'Russia (RU)', nameRu: 'Россия (RU)' },
  { code: 'DE', nameEn: 'Germany (DE)', nameRu: 'Германия (DE)' },
  { code: 'FR', nameEn: 'France (FR)', nameRu: 'Франция (FR)' },
  { code: 'CA', nameEn: 'Canada (CA)', nameRu: 'Канада (CA)' },
  { code: 'JP', nameEn: 'Japan (JP)', nameRu: 'Япония (JP)' },
  { code: 'KR', nameEn: 'South Korea (KR)', nameRu: 'Южная Корея (KR)' },
];
