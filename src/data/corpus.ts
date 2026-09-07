import type { SourceDoc } from '../types';

/**
 * A deliberately small, bilingual corpus.
 *
 * Small enough to index in the browser on every load, and bilingual so the
 * retrieval path is exercised in both scripts — Arabic retrieval is where
 * naive tokenisation quietly fails, which is the point worth demonstrating.
 */
export const CORPUS: SourceDoc[] = [
  {
    id: 'offside-en',
    title: 'Offside',
    lang: 'en',
    text: 'A player is in an offside position if any part of the head, body or feet is in the opponents half and closer to the opponents goal line than both the ball and the second-last opponent. Being in an offside position is not an offence in itself.',
  },
  {
    id: 'penalty-en',
    title: 'Penalty kick',
    lang: 'en',
    text: 'A penalty kick is awarded if a player commits a direct free kick offence inside their own penalty area. The kick is taken from the penalty mark, and all players except the kicker and the defending goalkeeper must be outside the penalty area.',
  },
  {
    id: 'extra-time-en',
    title: 'Extra time',
    lang: 'en',
    text: 'Extra time consists of two equal periods of fifteen minutes. If the score is still level after extra time, the match is decided by kicks from the penalty mark. Players may not be substituted once extra time has finished.',
  },
  {
    id: 'var-en',
    title: 'Video assistant referee',
    lang: 'en',
    text: 'The video assistant referee may review four categories of decision: goals and offences leading to a goal, penalty decisions, direct red card incidents, and mistaken identity. The final decision always rests with the on-field referee.',
  },
  {
    id: 'group-stage-en',
    title: 'Group stage tie-breakers',
    lang: 'en',
    text: 'When two or more teams finish a group on equal points, ranking is decided first by goal difference across all group matches, then by goals scored, and then by the result of the matches played between the teams concerned.',
  },
  {
    id: 'substitution-en',
    title: 'Substitutions',
    lang: 'en',
    text: 'Each team may use up to five substitutes during normal time, taken across a maximum of three stoppages plus the half-time interval. A substituted player takes no further part in the match.',
  },
  {
    id: 'offside-ar',
    title: 'التسلل',
    lang: 'ar',
    text: 'يكون اللاعب في موقف تسلل إذا كان أي جزء من رأسه أو جسمه أو قدميه في نصف ملعب الفريق المنافس وأقرب إلى خط مرمى المنافس من الكرة ومن ثاني آخر مدافع. الوجود في موقف تسلل ليس مخالفة في حد ذاته.',
  },
  {
    id: 'penalty-ar',
    title: 'ركلة الجزاء',
    lang: 'ar',
    text: 'تُحتسب ركلة الجزاء إذا ارتكب اللاعب مخالفة تستوجب ركلة حرة مباشرة داخل منطقة جزاء فريقه. تُنفَّذ الركلة من علامة الجزاء، ويجب أن يكون جميع اللاعبين خارج منطقة الجزاء باستثناء منفّذ الركلة وحارس المرمى المدافع.',
  },
  {
    id: 'extra-time-ar',
    title: 'الوقت الإضافي',
    lang: 'ar',
    text: 'يتكون الوقت الإضافي من شوطين متساويين مدة كل منهما خمس عشرة دقيقة. وإذا بقيت النتيجة متعادلة بعد الوقت الإضافي تُحسم المباراة بركلات الترجيح من علامة الجزاء.',
  },
  {
    id: 'var-ar',
    title: 'حكم الفيديو المساعد',
    lang: 'ar',
    text: 'يجوز لحكم الفيديو المساعد مراجعة أربع فئات من القرارات: الأهداف والمخالفات المؤدية إليها، وقرارات ركلة الجزاء، وحالات البطاقة الحمراء المباشرة، والخطأ في تحديد هوية اللاعب. ويبقى القرار النهائي لحكم الساحة.',
  },
];
