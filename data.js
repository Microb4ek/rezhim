/* Недельный шаблон расписания и тренировки.
   Всё статично, никаких запросов наружу. */

window.SCHEDULE = {
  monday: [
    { time: "06:30", title: "Подъём", kind: "wake" },
    { time: "06:45", title: "Небольшой перекус перед тренировкой", subtitle: "если голодна", kind: "food", mealId: "snack" },
    { time: "07:00", title: "Тренировка: ягодицы + задняя поверхность бедра", endTime: "07:50", workoutId: "monday_glutes", kind: "workout" },
    { time: "08:00", title: "Душ", kind: "shower" },
    { time: "08:15", title: "Полноценный завтрак", kind: "food", mealId: "breakfast" },
    { time: "09:10", title: "Выход из дома", kind: "out" },
    { time: "10:10", title: "Пары", endTime: "19:00", kind: "study", mealId: "lunch" },
    { time: "20:00", title: "Дома", kind: "home" },
    { time: "20:15", title: "Ужин", kind: "food", mealId: "dinner" },
    { time: "22:30", title: "Начинать готовиться ко сну", kind: "wind" },
    { time: "23:00", title: "Сон", kind: "sleep" }
  ],
  tuesday: [
    { time: "07:30", title: "Подъём", endTime: "08:00", kind: "wake" },
    { time: "08:00", title: "Завтрак", kind: "food", mealId: "breakfast" },
    { time: "09:10", title: "Выход", kind: "out" },
    { time: "10:10", title: "Пары", endTime: "19:00", kind: "study", mealId: "lunch" },
    { time: "20:00", title: "Дома", kind: "home" },
    { time: "20:15", title: "Ужин", kind: "food", mealId: "dinner" },
    { time: "23:00", title: "Сон", kind: "sleep" }
  ],
  wednesday: [
    { time: "06:45", title: "Подъём", endTime: "07:00", kind: "wake" },
    { time: "07:00", title: "Завтрак", kind: "food", mealId: "breakfast" },
    { time: "07:30", title: "Выход", kind: "out" },
    { time: "08:30", title: "Пары", endTime: "17:20", kind: "study", mealId: "lunch" },
    { time: "18:20", title: "Дома", kind: "home" },
    { time: "18:40", title: "Тренировка: спина + плечи + пресс", endTime: "19:25", workoutId: "wednesday_upper", kind: "workout" },
    { time: "19:40", title: "Ужин", kind: "food", mealId: "dinner" },
    { time: "22:30", title: "Спокойный режим", kind: "wind" },
    { time: "23:00", title: "Сон", kind: "sleep" }
  ],
  thursday: [
    { time: "08:00", title: "Подъём", kind: "wake" },
    { time: "08:15", title: "Завтрак", kind: "food", mealId: "breakfast" },
    { time: "09:10", title: "Выход", kind: "out" },
    { time: "10:10", title: "Пары", endTime: "20:40", kind: "study", mealId: "lunch" },
    { time: "21:40", title: "Дома", kind: "home" },
    { time: "22:00", title: "Ужин", kind: "food", mealId: "dinner" },
    { time: "23:00", title: "Сон", endTime: "23:30", kind: "sleep" }
  ],
  friday: [
    { time: "08:00", title: "Подъём", kind: "wake" },
    { time: "08:15", title: "Завтрак / перекус", subtitle: "лёгкий, перед тренировкой", kind: "food", mealId: "snack" },
    { time: "09:00", title: "Тренировка: ягодицы + ноги", endTime: "10:00", workoutId: "friday_glutes_legs", kind: "workout" },
    { time: "10:10", title: "Душ", kind: "shower" },
    { time: "10:30", title: "Основной приём пищи", kind: "food", mealId: "lunch" },
    { time: "11:10", title: "Выход", kind: "out" },
    { time: "12:10", title: "Пары", endTime: "15:20", kind: "study" },
    { time: "16:20", title: "Дома", kind: "home" },
    { time: "16:30", title: "Свободный вечер", kind: "free" }
  ],
  saturday: [
    { time: "07:30", title: "Подъём", endTime: "08:00", kind: "wake" },
    { time: "08:00", title: "Завтрак", kind: "food", mealId: "breakfast" },
    { time: "09:10", title: "Выход", kind: "out" },
    { time: "10:10", title: "Пары", endTime: "13:40", kind: "study" },
    { time: "14:40", title: "Дома", kind: "home" }
  ],
  sunday: [
    { time: "09:00", title: "Подъём", kind: "wake" },
    { time: "09:30", title: "Завтрак", kind: "food", mealId: "breakfast" },
    { time: "11:00", title: "Тренировка: ягодицы", endTime: "12:00", workoutId: "sunday_glutes", kind: "workout" },
    { time: "12:00", title: "Свободный день", kind: "free" }
  ]
};

/* Вариант субботы с вечерней парой 19:10–20:40.
   Включается переключателем на экране конкретной субботы. */
window.SATURDAY_EVENING = [
  { time: "18:10", title: "Выход", kind: "out" },
  { time: "19:10", title: "Вечерняя пара", endTime: "20:40", kind: "study" },
  { time: "21:40", title: "Дома", kind: "home" }
];

/* Рационы: пул вариантов на каждый приём пищи (из таблицы питания).
   Ингредиенты разделены « + » — на экране показываются как отдельные метки. */
window.MEALS = {
  breakfast: {
    title: "Завтрак",
    hint: "Плотный старт: каша, творог или яйца",
    options: [
      "овсянка + яблоко + 2 яйца",
      "овсянка + банан + 2 яйца",
      "овсянка + яблоко + творог",
      "овсянка + творог + банан",
      "овсяноблин с творогом и бананом",
      "творог + банан + хлеб",
      "творог + банан",
      "творог + яблоко + овсянка",
      "омлет из 2 яиц + хлеб + овощи",
      "омлет + хлеб + помидор",
      "омлет + хлеб",
      "яйца + хлеб + овощи",
      "сырники без сахара",
      "сырники без сахара + йогурт"
    ]
  },
  snack: {
    title: "Перекус",
    hint: "Лёгкий: фрукт и кисломолочное",
    options: [
      "яблоко + кефир",
      "яблоко + йогурт",
      "банан + кефир",
      "банан + йогурт",
      "фрукт + кефир",
      "фрукт + йогурт",
      "творог + фрукт",
      "творог + ягоды",
      "творог + яблоко",
      "банан",
      "фрукт"
    ]
  },
  lunch: {
    title: "Обед · с собой",
    hint: "Собрать заранее и взять на пары",
    options: [
      "лаваш с курицей и овощами",
      "лаваш с курицей, капустой и огурцом",
      "лаваш с яйцом и курицей",
      "лаваш с курицей",
      "2 бутерброда с курицей и сыром + огурец",
      "2 бутерброда с яйцом и курицей",
      "бутерброды с курицей + овощи",
      "гречка + курица + огурец/помидор",
      "гречка + курица + овощи",
      "гречка + курица",
      "рис + курица + овощи",
      "рис + курица",
      "курица + картофель + салат",
      "курица + картофель + овощи"
    ]
  },
  dinner: {
    title: "Ужин",
    hint: "Гарнир + белок + овощи, либо лёгкий творожный",
    options: [
      "гречка + курица + салат",
      "гречка + курица + овощи",
      "гречка + курица",
      "гречка + рыба",
      "гречка + яйца + овощи",
      "гречка + яйца",
      "гречка + творог + овощи",
      "рис + курица + овощи",
      "рис + рыба + салат",
      "картофель + курица",
      "картофель + рыба + салат",
      "картофель + рыба",
      "картофель + 2 яйца + салат",
      "макароны + курица + салат",
      "макароны + курица + овощи",
      "макароны + курица",
      "творог + ягоды",
      "творог + ягоды + немного овсянки",
      "лёгкий ужин: творог или яйца + овощи"
    ]
  }
};

window.WORKOUTS = {
  monday_glutes: {
    title: "Ягодицы + задняя поверхность бедра",
    exercises: [
      { name: "Hip thrust с рюкзаком/гантелью", sets: "4×8–12" },
      { name: "Румынская тяга", sets: "4×8–12" },
      { name: "Болгарские приседания", sets: "3×8–12 на ногу" },
      { name: "Ягодичный мост", sets: "3×12–15" },
      { name: "Отведение ноги назад", sets: "3×15–20" },
      { name: "Разведение ног с резинкой", sets: "2×20–25" }
    ]
  },
  wednesday_upper: {
    title: "Спина + плечи + пресс",
    exercises: [
      { name: "Тяга рюкзака к поясу", sets: "4×10–15" },
      { name: "Тяга резинки сверху", sets: "3×10–15" },
      { name: "Жим гантелей/бутылок вверх", sets: "3×10–12" },
      { name: "Разведения рук в стороны", sets: "3×15–20" },
      { name: "Разведения на заднюю дельту", sets: "3×15–20" },
      { name: "Dead bug", sets: "3×10–15" },
      { name: "Обратные скручивания", sets: "3×12–15" },
      { name: "Планка", sets: "2×30–60 сек" }
    ]
  },
  friday_glutes_legs: {
    title: "Ягодицы + ноги",
    exercises: [
      { name: "Hip thrust", sets: "4×8–12" },
      { name: "Присед с рюкзаком", sets: "3×8–12" },
      { name: "Выпады назад", sets: "3×10–12 на ногу" },
      { name: "Румынская тяга", sets: "3×10–12" },
      { name: "Step-up", sets: "3×10–12 на ногу" },
      { name: "Отведение ноги в сторону", sets: "3×15–25" }
    ]
  },
  sunday_glutes: {
    title: "Ягодицы",
    exercises: [
      { name: "Ягодичный мост", sets: "4×12–15" },
      { name: "Болгарские приседания", sets: "3×10–12" },
      { name: "Румынская тяга на одной ноге", sets: "3×10–12" },
      { name: "Выпады назад", sets: "3×10–12" },
      { name: "Frog pumps", sets: "3×20–30" },
      { name: "Отведение ноги назад", sets: "3×15–25" },
      { name: "Разведение ног", sets: "2×20–30" }
    ]
  }
};
