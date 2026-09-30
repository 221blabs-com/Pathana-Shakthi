// Word Dictionary: everyday words a primary child should be able to read and
// say, grouped by topic, with a picture, a meaning in English and (for
// Telugu/Hindi) how it sounds in English letters. `grades` limits harder
// words to older classes. Teachers' published books add their chapters' key
// vocabulary on top of this list (WordDictionaryPage).
import { Language } from '../types';

export interface DictionaryWord {
  word: string;
  language: Language;
  meaning: string;
  emoji: string;
  category: string;
  grades: [number, number];
  // How a Telugu/Hindi word sounds, in English letters.
  sounds?: string;
  // A short sentence using the word (English words for Class 3+).
  example?: string;
  // The meaning is the Oxford Dictionaries definition (book/hard words).
  oxford?: boolean;
}

const en = (word: string, emoji: string, category: string, meaning: string, grades: [number, number] = [1, 5], example?: string): DictionaryWord => ({
  word,
  language: 'English',
  emoji,
  category,
  meaning,
  grades,
  example,
});
const te = (word: string, sounds: string, emoji: string, category: string, meaning: string, grades: [number, number] = [1, 5]): DictionaryWord => ({
  word,
  language: 'Telugu',
  sounds,
  emoji,
  category,
  meaning,
  grades,
});
const hi = (word: string, sounds: string, emoji: string, category: string, meaning: string, grades: [number, number] = [1, 5]): DictionaryWord => ({
  word,
  language: 'Hindi',
  sounds,
  emoji,
  category,
  meaning,
  grades,
});

export const DICTIONARY_WORDS: DictionaryWord[] = [
  /* ------------------------------ English ------------------------------ */
  en('cat', '🐈', 'Animals', 'A small furry pet that says meow.', [1, 2]),
  en('dog', '🐕', 'Animals', 'A friendly pet that barks.', [1, 2]),
  en('cow', '🐄', 'Animals', 'A farm animal that gives us milk.', [1, 2]),
  en('fish', '🐟', 'Animals', 'An animal that lives and swims in water.', [1, 2]),
  en('bird', '🐦', 'Animals', 'An animal with feathers and wings.', [1, 3]),
  en('elephant', '🐘', 'Animals', 'A very big grey animal with a long trunk.', [2, 5], 'The elephant lifts a log with its trunk.'),
  en('butterfly', '🦋', 'Animals', 'An insect with big, colourful wings.', [2, 5], 'A butterfly sat on the red flower.'),
  en('apple', '🍎', 'Food', 'A round red or green fruit.', [1, 2]),
  en('mango', '🥭', 'Food', 'A sweet yellow fruit. It is the king of fruits.', [1, 3]),
  en('banana', '🍌', 'Food', 'A long yellow fruit.', [1, 2]),
  en('milk', '🥛', 'Food', 'A white drink that makes our bones strong.', [1, 2]),
  en('water', '💧', 'Food', 'We drink water every day.', [1, 2]),
  en('vegetable', '🥕', 'Food', 'A plant we eat, like a carrot or a tomato.', [3, 5], 'Eat a vegetable with every meal.'),
  en('breakfast', '🍳', 'Food', 'The first meal of the day.', [3, 5], 'I eat idli for breakfast.'),
  en('delicious', '😋', 'Food', 'Very tasty.', [3, 5], 'Amma made a delicious payasam.'),
  en('ball', '⚽', 'Things', 'A round toy we throw, kick or catch.', [1, 2]),
  en('book', '📖', 'School', 'Pages with words and pictures to read.', [1, 2]),
  en('bag', '🎒', 'School', 'We carry our books in a bag.', [1, 2]),
  en('pen', '🖊️', 'School', 'We write with a pen.', [1, 2]),
  en('school', '🏫', 'School', 'A place where children learn.', [1, 3]),
  en('teacher', '👩‍🏫', 'School', 'A person who helps us learn.', [2, 5], 'Our teacher reads us a story.'),
  en('library', '📚', 'School', 'A room full of books to read.', [3, 5], 'We borrow books from the library.'),
  en('question', '❓', 'School', 'Something we ask to find out.', [3, 5], 'I asked a question in class.'),
  en('answer', '✅', 'School', 'What we say or write back to a question.', [3, 5], 'She knew the answer.'),
  en('sun', '☀️', 'Nature', 'The bright star that gives us light in the day.', [1, 2]),
  en('moon', '🌙', 'Nature', 'It shines in the sky at night.', [1, 2]),
  en('star', '⭐', 'Nature', 'A tiny light we see in the night sky.', [1, 2]),
  en('tree', '🌳', 'Nature', 'A tall plant with a trunk, branches and leaves.', [1, 2]),
  en('flower', '🌸', 'Nature', 'The colourful part of a plant.', [1, 3]),
  en('rain', '🌧️', 'Nature', 'Water that falls from the clouds.', [1, 3]),
  en('rainbow', '🌈', 'Nature', 'Seven colours in the sky after rain.', [2, 5], 'We saw a rainbow after the rain.'),
  en('mountain', '⛰️', 'Nature', 'A very high hill.', [3, 5], 'The mountain is covered with trees.'),
  en('river', '🏞️', 'Nature', 'A long stream of water that flows.', [3, 5], 'The Godavari is a big river.'),
  en('forest', '🌲', 'Nature', 'A large area full of trees.', [3, 5], 'Tigers live in the forest.'),
  en('weather', '🌦️', 'Nature', 'How hot, cold, sunny or rainy it is outside.', [3, 5], 'The weather is sunny today.'),
  en('planet', '🪐', 'Nature', 'A big round world that goes around the sun.', [4, 5], 'Earth is our planet.'),
  en('red', '🔴', 'Colours', 'The colour of a ripe tomato.', [1, 2]),
  en('blue', '🔵', 'Colours', 'The colour of the clear sky.', [1, 2]),
  en('green', '🟢', 'Colours', 'The colour of leaves.', [1, 2]),
  en('yellow', '🟡', 'Colours', 'The colour of a banana.', [1, 2]),
  en('mother', '👩', 'Family', 'Your amma.', [1, 2]),
  en('father', '👨', 'Family', 'Your nanna.', [1, 2]),
  en('sister', '👧', 'Family', 'A girl who has the same parents as you.', [1, 3]),
  en('brother', '👦', 'Family', 'A boy who has the same parents as you.', [1, 3]),
  en('friend', '🤝', 'Family', 'Someone you like and play with.', [1, 3]),
  en('hand', '✋', 'My Body', 'We hold things with our hand.', [1, 2]),
  en('eye', '👁️', 'My Body', 'We see with our eyes.', [1, 2]),
  en('ear', '👂', 'My Body', 'We hear with our ears.', [1, 2]),
  en('nose', '👃', 'My Body', 'We smell with our nose.', [1, 2]),
  en('healthy', '💪', 'My Body', 'Strong and well, not sick.', [3, 5], 'Fruits keep us healthy.'),
  en('run', '🏃', 'Actions', 'To move fast on your feet.', [1, 2]),
  en('jump', '🦘', 'Actions', 'To push up off the ground into the air.', [1, 2]),
  en('eat', '🍽️', 'Actions', 'To put food in your mouth.', [1, 2]),
  en('sleep', '😴', 'Actions', 'To rest with your eyes closed at night.', [1, 2]),
  en('remember', '🧠', 'Actions', 'To keep something in your mind.', [3, 5], 'I remember my first day at school.'),
  en('imagine', '💭', 'Actions', 'To make a picture in your mind.', [3, 5], 'Imagine you can fly like a bird.'),
  en('happy', '😀', 'Feelings', 'Feeling good and glad.', [1, 2]),
  en('sad', '😢', 'Feelings', 'Feeling unhappy.', [1, 2]),
  en('brave', '🦁', 'Feelings', 'Not afraid to do something hard.', [3, 5], 'The brave girl helped the lost puppy.'),
  en('honest', '🤲', 'Feelings', 'Always telling the truth.', [3, 5], 'An honest boy returned the purse.'),
  en('careful', '⚠️', 'Feelings', 'Paying attention so nothing goes wrong.', [3, 5], 'Be careful when you cross the road.'),
  en('beautiful', '🌺', 'Feelings', 'Very nice to look at.', [3, 5], 'The garden looks beautiful.'),
  en('big', '🐘', 'Describing', 'Large in size.', [1, 2]),
  en('small', '🐜', 'Describing', 'Little in size.', [1, 2]),
  en('different', '🔀', 'Describing', 'Not the same.', [3, 5], 'Each leaf is a different shape.'),
  en('important', '❗', 'Describing', 'Something that matters a lot.', [4, 5], 'Clean water is important for everyone.'),
  en('house', '🏠', 'Places', 'A building where a family lives.', [1, 2]),
  en('village', '🏡', 'Places', 'A small place in the countryside where people live.', [3, 5], 'My grandmother lives in a village.'),
  en('kitchen', '🍲', 'Places', 'The room where food is cooked.', [3, 5], 'Amma is cooking in the kitchen.'),
  en('garden', '🪴', 'Places', 'A place where plants and flowers grow.', [2, 5], 'We water the plants in the garden.'),
  en('doctor', '👩‍⚕️', 'People', 'A person who helps sick people get well.', [2, 5], 'The doctor checked my fever.'),
  en('farmer', '👨‍🌾', 'People', 'A person who grows crops.', [2, 5], 'The farmer grows rice in the field.'),
  en('bicycle', '🚲', 'Things', 'A cycle with two wheels and pedals.', [3, 5], 'I ride my bicycle to school.'),
  en('umbrella', '☂️', 'Things', 'It keeps us dry in the rain.', [2, 5], 'Take an umbrella, it is raining.'),
  en('festival', '🪔', 'Things', 'A special day we celebrate together.', [3, 5], 'Diwali is a festival of lights.'),

  /* ------------------------------ Telugu ------------------------------ */
  te('అమ్మ', 'amma', '👩', 'Family', 'Mother', [1, 5]),
  te('నాన్న', 'nanna', '👨', 'Family', 'Father', [1, 5]),
  te('అక్క', 'akka', '👧', 'Family', 'Elder sister', [1, 5]),
  te('అన్న', 'anna', '👦', 'Family', 'Elder brother', [1, 5]),
  te('స్నేహితుడు', 'snehitudu', '🤝', 'Family', 'Friend', [2, 5]),
  te('ఇల్లు', 'illu', '🏠', 'Places', 'House', [1, 5]),
  te('బడి', 'badi', '🏫', 'School', 'School', [1, 5]),
  te('పుస్తకం', 'pustakam', '📖', 'School', 'Book', [1, 5]),
  te('గురువు', 'guruvu', '👩‍🏫', 'School', 'Teacher', [2, 5]),
  te('నీరు', 'neeru', '💧', 'Food', 'Water', [1, 5]),
  te('పాలు', 'paalu', '🥛', 'Food', 'Milk', [1, 5]),
  te('అన్నం', 'annam', '🍚', 'Food', 'Cooked rice', [1, 5]),
  te('పండు', 'pandu', '🍎', 'Food', 'Fruit', [1, 5]),
  te('అరటిపండు', 'aratipandu', '🍌', 'Food', 'Banana', [2, 5]),
  te('కుక్క', 'kukka', '🐕', 'Animals', 'Dog', [1, 5]),
  te('పిల్లి', 'pilli', '🐈', 'Animals', 'Cat', [1, 5]),
  te('ఆవు', 'aavu', '🐄', 'Animals', 'Cow', [1, 5]),
  te('ఏనుగు', 'enugu', '🐘', 'Animals', 'Elephant', [1, 5]),
  te('పక్షి', 'pakshi', '🐦', 'Animals', 'Bird', [2, 5]),
  te('చేప', 'chepa', '🐟', 'Animals', 'Fish', [1, 5]),
  te('చెట్టు', 'chettu', '🌳', 'Nature', 'Tree', [1, 5]),
  te('పువ్వు', 'puvvu', '🌸', 'Nature', 'Flower', [1, 5]),
  te('సూర్యుడు', 'suryudu', '☀️', 'Nature', 'Sun', [2, 5]),
  te('చంద్రుడు', 'chandrudu', '🌙', 'Nature', 'Moon', [2, 5]),
  te('నక్షత్రం', 'nakshatram', '⭐', 'Nature', 'Star', [3, 5]),
  te('వాన', 'vaana', '🌧️', 'Nature', 'Rain', [1, 5]),
  te('కన్ను', 'kannu', '👁️', 'My Body', 'Eye', [1, 5]),
  te('చెయ్యి', 'cheyyi', '✋', 'My Body', 'Hand', [1, 5]),
  te('ఆట', 'aata', '⚽', 'Things', 'Game', [1, 5]),
  te('సంతోషం', 'santosham', '😀', 'Feelings', 'Happiness', [2, 5]),

  /* ------------------------------ Hindi ------------------------------ */
  hi('माँ', 'maa', '👩', 'Family', 'Mother', [1, 5]),
  hi('पिता', 'pita', '👨', 'Family', 'Father', [1, 5]),
  hi('बहन', 'bahan', '👧', 'Family', 'Sister', [1, 5]),
  hi('भाई', 'bhai', '👦', 'Family', 'Brother', [1, 5]),
  hi('दोस्त', 'dost', '🤝', 'Family', 'Friend', [1, 5]),
  hi('घर', 'ghar', '🏠', 'Places', 'House', [1, 5]),
  hi('विद्यालय', 'vidyalay', '🏫', 'School', 'School', [3, 5]),
  hi('किताब', 'kitaab', '📖', 'School', 'Book', [1, 5]),
  hi('शिक्षक', 'shikshak', '👩‍🏫', 'School', 'Teacher', [3, 5]),
  hi('पानी', 'paani', '💧', 'Food', 'Water', [1, 5]),
  hi('दूध', 'doodh', '🥛', 'Food', 'Milk', [1, 5]),
  hi('चावल', 'chaaval', '🍚', 'Food', 'Rice', [1, 5]),
  hi('फल', 'phal', '🍎', 'Food', 'Fruit', [1, 5]),
  hi('आम', 'aam', '🥭', 'Food', 'Mango', [1, 5]),
  hi('केला', 'kela', '🍌', 'Food', 'Banana', [1, 5]),
  hi('कुत्ता', 'kutta', '🐕', 'Animals', 'Dog', [1, 5]),
  hi('बिल्ली', 'billi', '🐈', 'Animals', 'Cat', [1, 5]),
  hi('गाय', 'gaay', '🐄', 'Animals', 'Cow', [1, 5]),
  hi('हाथी', 'haathi', '🐘', 'Animals', 'Elephant', [1, 5]),
  hi('चिड़िया', 'chidiya', '🐦', 'Animals', 'Bird', [2, 5]),
  hi('मछली', 'machhli', '🐟', 'Animals', 'Fish', [1, 5]),
  hi('पेड़', 'ped', '🌳', 'Nature', 'Tree', [1, 5]),
  hi('फूल', 'phool', '🌸', 'Nature', 'Flower', [1, 5]),
  hi('सूरज', 'sooraj', '☀️', 'Nature', 'Sun', [1, 5]),
  hi('चाँद', 'chaand', '🌙', 'Nature', 'Moon', [1, 5]),
  hi('तारा', 'taara', '⭐', 'Nature', 'Star', [1, 5]),
  hi('बारिश', 'baarish', '🌧️', 'Nature', 'Rain', [2, 5]),
  hi('आँख', 'aankh', '👁️', 'My Body', 'Eye', [1, 5]),
  hi('हाथ', 'haath', '✋', 'My Body', 'Hand', [1, 5]),
  hi('खेल', 'khel', '⚽', 'Things', 'Game', [1, 5]),
  hi('खुशी', 'khushi', '😀', 'Feelings', 'Happiness', [2, 5]),
];

export function dictionaryFor(language: Language, grade: string): DictionaryWord[] {
  const n = Number(String(grade || '').replace(/\D/g, '')) || 1;
  return DICTIONARY_WORDS.filter((w) => w.language === language && n >= w.grades[0] && n <= w.grades[1]);
}
