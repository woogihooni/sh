// 전역 변수 선언
let allQuizData = []; // 모든 퀴즈 데이터를 저장할 배열
let filteredQuizData = []; // 선택된 회차 및 과목에 따라 필터링된 퀴즈 데이터
let rounds = []; // 사용 가능한 모든 회차 (연월일)
let availableSubjects = []; // 사용 가능한 모든 과목
let currentQuestionIndex = 0; // 현재 풀고 있는 문제의 인덱스
let score = 0; // 점수
let selectedOption = null; // 사용자가 선택한 옵션을 저장할 변수
let incorrectQuestions = []; // 틀린 문제들을 저장할 배열 (현재 세션 내에서만 유효)
let isReviewMode = false; // 틀린 문제 풀이 모드인지 여부
let isCheckedQuestionsMode = false; // 체크 문제 풀이 모드인지 여부
let selectedSubjectsForCheckedQuiz = []; // 체크 문제 풀이 시 선택된 과목들

// 로컬 스토리지 키
const CHECKED_QUESTIONS_KEY = 'checkedQuestions'; // { 'YYYYMMDD-문제번호': true } 형태
const LAST_QUIZ_STATE_KEY = 'lastQuizState'; // 일반 퀴즈의 마지막 푼 문제 정보 저장용
const LAST_CHECKED_QUIZ_STATE_KEY = 'lastCheckedQuizState'; // 체크 퀴즈의 마지막 푼 문제 정보 저장용
const TEMPORARY_EXPLANATIONS_KEY = 'temporaryExplanations'; // 임시 저장 해설 저장용

// 페이지 로드 시 초기화 함수 호출
document.addEventListener('DOMContentLoaded', init);

async function init() {
    await loadQuizData(); // 퀴즈 데이터 로드
    setupEventListeners(); // 이벤트 리스너 설정
    showPage('main-page'); // 메인 페이지 표시
    updateContinueLastQuizButton(); // 일반 퀴즈 마지막 푼 문제 버튼 상태 업데이트
    updateContinueLastCheckedQuizButton(); // 체크 퀴즈 마지막 푼 문제 버튼 상태 업데이트
}

async function loadQuizData() {
    try {
        const response = await fetch('quiz_data.json');

        if (!response.ok) {
            throw new Error(`HTTP 오류! 상태: ${response.status} ${response.statusText}`);
        }

        allQuizData = await response.json();

        // '연월일' 필드를 기준으로 오름차순 정렬된 유니크한 회차 목록 생성
        rounds = [...new Set(allQuizData.map(q => q['연월일']))].sort();
        availableSubjects = [...new Set(allQuizData.map(q => q['과목']))].sort();

        populateMainPage();
        populateCheckedQuizSubjectSelection(); // 체크 문제 풀이용 과목 선택 UI도 미리 채워둡니다.
    } catch (error) {
        console.error('퀴즈 데이터를 로드하는 중 오류 발생:', error);

        let errorMessage = '퀴즈 데이터를 불러오는 데 실패했습니다.';

        if (error instanceof TypeError) {
            errorMessage += '\n네트워크 연결을 확인하거나 파일 경로를 다시 확인해주세요.';
            errorMessage += '\n("quiz_data.json" 파일을 찾을 수 없습니다.)';
        } else if (error.message.includes('HTTP 오류')) {
            errorMessage += `\n서버 응답 오류: ${error.message}`;
            errorMessage += '\n("quiz_data.json" 파일이 올바른 위치에 있는지 확인해주세요.)';
        } else if (error instanceof SyntaxError) {
            errorMessage += '\n"quiz_data.json" 파일의 내용이 유효한 JSON 형식이 아닙니다.';
            errorMessage += '\n파일 내용을 텍스트 편집기로 열어 JSON 문법 오류를 확인해주세요.';
        } else {
            errorMessage += `\n자세한 오류: ${error.message}`;
        }

        alert(errorMessage);
    }
}

function populateMainPage() {
    const roundSelect = document.getElementById('round-select');
    const subjectCheckboxesContainer = document.getElementById('subject-checkboxes-container');
    const toggleAllSubjectsButton = document.getElementById('toggle-all-subjects-button');

    roundSelect.innerHTML = '<option value="">회차 선택</option>';
    rounds.forEach(round => {
        const option = document.createElement('option');
        option.value = round;
        option.textContent = round;
        roundSelect.appendChild(option);
    });

    subjectCheckboxesContainer.innerHTML = '';
    availableSubjects.forEach(subject => {
        const label = document.createElement('label');
        // 과목 선택 체크박스는 기본적으로 해제된 상태로 표시
        label.innerHTML = `
            <input type="checkbox" name="subject" value="${subject}"> ${subject}
        `;
        subjectCheckboxesContainer.appendChild(label);
    });

    // 메인 페이지 로드 시 '전체 선택' 버튼 텍스트 초기화
    if (toggleAllSubjectsButton) {
        toggleAllSubjectsButton.textContent = '전체 선택';
    }
}

function populateCheckedQuizSubjectSelection() {
    const checkedQuizSubjectCheckboxesContainer = document.getElementById('checked-subject-checkboxes-container');
    if (!checkedQuizSubjectCheckboxesContainer) {
        console.warn("#checked-subject-checkboxes-container 요소를 찾을 수 없습니다. 체크 문제 풀이 과목 선택 UI를 초기화할 수 없습니다.");
        return;
    }

    checkedQuizSubjectCheckboxesContainer.innerHTML = '';

    const toggleButton = document.createElement('button');
    toggleButton.id = 'toggle-all-checked-subjects-button';
    toggleButton.textContent = '전체 선택';
    toggleButton.addEventListener('click', toggleAllCheckedSubjects);
    checkedQuizSubjectCheckboxesContainer.appendChild(toggleButton);

    const checkboxesWrapper = document.createElement('div');
    checkboxesWrapper.classList.add('subject-checkboxes-wrapper');
    checkedQuizSubjectCheckboxesContainer.appendChild(checkboxesWrapper);


    availableSubjects.forEach(subject => {
        const label = document.createElement('label');
        label.innerHTML = `
            <input type="checkbox" name="checkedSubject" value="${subject}"> ${subject}
        `;
        checkboxesWrapper.appendChild(label);
    });
}


function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => {
        page.style.display = 'none';
    });
    document.getElementById(pageId).style.display = 'block';

    const checkedQuizModal = document.getElementById('checked-quiz-modal');
    if (pageId === 'main-page' && checkedQuizModal) {
        checkedQuizModal.style.display = 'none';
        updateContinueLastCheckedQuizButton(); // 모달 닫힐 때 상태 갱신
    }
}

function toggleAllSubjects() {
    const subjectCheckboxes = document.querySelectorAll('#subject-checkboxes-container input[type="checkbox"]');
    const toggleButton = document.getElementById('toggle-all-subjects-button');

    const allCurrentlyChecked = Array.from(subjectCheckboxes).every(cb => cb.checked);

    subjectCheckboxes.forEach(checkbox => {
        checkbox.checked = !allCurrentlyChecked;
    });

    toggleButton.textContent = allCurrentlyChecked ? '전체 선택' : '전체 해제';
}

function toggleAllCheckedSubjects() {
    const subjectCheckboxes = document.querySelectorAll('#checked-subject-checkboxes-container .subject-checkboxes-wrapper input[name="checkedSubject"]');
    const toggleButton = document.getElementById('toggle-all-checked-subjects-button');

    const allCurrentlyChecked = Array.from(subjectCheckboxes).every(cb => cb.checked);

    subjectCheckboxes.forEach(checkbox => {
        checkbox.checked = !allCurrentlyChecked;
    });

    toggleButton.textContent = allCurrentlyChecked ? '전체 선택' : '전체 해제';
}

// --- 로컬 스토리지 관련 함수 (체크된 문제) ---
function getCheckedQuestions() {
    const data = localStorage.getItem(CHECKED_QUESTIONS_KEY);
    try {
        const parsed = data ? JSON.parse(data) : {};
        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
            return parsed;
        } else {
            console.warn("경고: 'checkedQuestions' localStorage 데이터가 유효한 객체 형식이 아닙니다. 데이터를 초기화합니다.");
            return {};
        }
    } catch (e) {
        console.error("오류: 'checkedQuestions' localStorage 데이터를 파싱하는 중 오류 발생. 데이터를 초기화합니다.", e);
        return {};
    }
}

function saveCheckedQuestion(round, questionNumber) {
    const checkedQuestions = getCheckedQuestions();
    const key = `${round}-${questionNumber}`;
    checkedQuestions[key] = true;
    localStorage.setItem(CHECKED_QUESTIONS_KEY, JSON.stringify(checkedQuestions));
}

function removeCheckedQuestion(round, questionNumber) {
    const checkedQuestions = getCheckedQuestions();
    const key = `${round}-${questionNumber}`;
    delete checkedQuestions[key];
    localStorage.setItem(CHECKED_QUESTIONS_KEY, JSON.stringify(checkedQuestions));
}

function isQuestionChecked(round, questionNumber) {
    const checkedQuestions = getCheckedQuestions();
    const key = `${round}-${questionNumber}`;
    return !!checkedQuestions[key];
}
// --- 로컬 스토리지 관련 함수 (체크된 문제) 끝 ---

// --- 로컬 스토리지 관련 함수 (일반 퀴즈 마지막 푼 문제) ---
function getLastQuizState() {
    const data = localStorage.getItem(LAST_QUIZ_STATE_KEY);
    return data ? JSON.parse(data) : null;
}

function saveLastQuizState(round, subjects, questionIndex) {
    const state = { round, subjects, questionIndex };
    localStorage.setItem(LAST_QUIZ_STATE_KEY, JSON.stringify(state));
    updateContinueLastQuizButton();
}

function clearLastQuizState() {
    localStorage.removeItem(LAST_QUIZ_STATE_KEY);
    updateContinueLastQuizButton();
}

function updateContinueLastQuizButton() {
    const continueButton = document.getElementById('continue-last-quiz-button');
    const lastState = getLastQuizState();
    if (lastState && lastState.subjects) {
        continueButton.style.display = 'inline-block';
        continueButton.textContent = `마지막 푼 문제부터 (${lastState.round} ${lastState.subjects.join(', ')} - ${lastState.questionIndex + 1}번)`;
    } else {
        continueButton.style.display = 'none';
    }
}
// --- 로컬 스토리지 관련 함수 (일반 퀴즈 마지막 푼 문제) 끝 ---

// --- 로컬 스토리지 관련 함수 (체크 퀴즈 마지막 푼 문제) ---
function getLastCheckedQuizState() {
    const data = localStorage.getItem(LAST_CHECKED_QUIZ_STATE_KEY);
    return data ? JSON.parse(data) : null;
}

function saveLastCheckedQuizState(subjects, questionIndex) {
    const state = { subjects, questionIndex };
    localStorage.setItem(LAST_CHECKED_QUIZ_STATE_KEY, JSON.stringify(state));
    updateContinueLastCheckedQuizButton();
}

function clearLastCheckedQuizState() {
    localStorage.removeItem(LAST_CHECKED_QUIZ_STATE_KEY);
    updateContinueLastCheckedQuizButton();
}

function updateContinueLastCheckedQuizButton() {
    const continueButton = document.getElementById('continue-last-checked-quiz-button');
    const lastState = getLastCheckedQuizState();
    if (continueButton) {
        if (lastState && lastState.subjects) {
            continueButton.style.display = 'inline-block';
            continueButton.textContent = `마지막 푼 체크 문제부터 (${lastState.subjects.join(', ')} - ${lastState.questionIndex + 1}번)`;
        } else {
            continueButton.style.display = 'none';
        }
    }
}
// --- 로컬 스토리지 관련 함수 (체크 퀴즈 마지막 푼 문제) 끝 ---

// --- 로컬 스토리지 관련 함수 (임시 저장 해설) ---
function getTemporaryExplanations() {
    const data = localStorage.getItem(TEMPORARY_EXPLANATIONS_KEY);
    try {
        const parsed = data ? JSON.parse(data) : {};
        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
            return parsed;
        } else {
            console.warn("경고: 'temporaryExplanations' localStorage 데이터가 유효한 객체 형식이 아닙니다. 데이터를 초기화합니다.");
            return {};
        }
    } catch (e) {
        console.error("오류: 'temporaryExplanations' localStorage 데이터를 파싱하는 중 오류 발생. 데이터를 초기화합니다.", e);
        return {};
    }
}

function saveTemporaryExplanation() {
    const currentQuestion = filteredQuizData[currentQuestionIndex];
    if (!currentQuestion) {
        alert('현재 문제 정보가 없습니다.');
        return;
    }

    const explanationInput = document.getElementById('new-explanation-input');
    let explanationText = explanationInput.value.trim();

    const explanationToSave = explanationText.replace(/,/g, '_');

    const tempExplanations = getTemporaryExplanations();
    const key = `${currentQuestion['연월일']}-${currentQuestion['문제번호']}`;

    if (explanationToSave === '') {
        delete tempExplanations[key];
        alert('해설이 삭제되었습니다.');
    } else {
        tempExplanations[key] = explanationToSave;
        alert('해설이 임시 저장되었습니다.');
    }

    localStorage.setItem(TEMPORARY_EXPLANATIONS_KEY, JSON.stringify(tempExplanations));
}

function exportTemporaryExplanations() {
    const tempExplanations = getTemporaryExplanations();
    const exportData = [];

    const sortedKeys = Object.keys(tempExplanations).sort((a, b) => {
        const [roundA, qNumA] = a.split('-');
        const [roundB, qNumB] = b.split('-');
        if (roundA === roundB) {
            return roundA.localeCompare(roundB);
        }
        return parseInt(qNumA) - parseInt(qNumB);
    });

    sortedKeys.forEach(key => {
        const [round, questionNumber] = key.split('-');
        const explanation = tempExplanations[key];
        exportData.push(`회차: ${round}, 문제번호: ${questionNumber}, 해설: ${explanation}`);
    });

    if (exportData.length === 0) {
        alert('임시 저장된 해설이 없습니다.');
        return;
    }

    const contentToCopy = exportData.join('\n\n');

    navigator.clipboard.writeText(contentToCopy)
        .then(() => {
            alert('임시 저장된 해설이 클립보드에 복사되었습니다.');
        })
        .catch(err => {
            console.error('클립보드 복사 실패:', err);
            alert('클립보드 복사에 실패했습니다. 브라우저 설정을 확인해주세요.');
        });
}

function clearTemporaryExplanations() {
    if (confirm('모든 임시 저장된 해설을 삭제하시겠습니까?')) {
        localStorage.removeItem(TEMPORARY_EXPLANATIONS_KEY);
        alert('임시 저장된 해설이 모두 삭제되었습니다.');
        const explanationInput = document.getElementById('new-explanation-input');
        if (explanationInput) {
            explanationInput.value = '';
        }
    }
}

function getTemporaryExplanation(round, questionNumber) {
    const tempExplanations = getTemporaryExplanations();
    const key = `${round}-${questionNumber}`;
    return tempExplanations[key] || '';
}
// --- 로컬 스토리지 관련 함수 (임시 저장 해설) 끝 ---

// 정답 문자열을 숫자(1, 2, 3, 4)로 파싱하는 헬퍼 함수
function parseCorrectAnswer(answerString) {
    if (typeof answerString !== 'string') {
        console.warn(`경고: 정답 형식이 문자열이 아닙니다 - '${answerString}'.`);
        return null;
    }

    const unicodeMap = { '①': 1, '②': 2, '③': 3, '④': 4, '⑤': 5 };

    if (unicodeMap[answerString.trim()]) {
        return unicodeMap[answerString.trim()];
    }

    const parsedNum = parseInt(answerString.trim());
    if (!isNaN(parsedNum) && parsedNum >= 1 && parsedNum <= 5) {
        return parsedNum;
    }

    console.warn(`경고: 알 수 없는 정답 형식 - '${answerString}'. 유효하지 않은 정답으로 처리됩니다.`);
    return null;
}

// 퀴즈 시작 함수 (다양한 모드 지원)
function startQuiz(quizQuestions = null, isReview = false, isChecked = false, startFromIndex = 0) {
    let quizToStart = [];
    let selectedRound = '';
    let selectedSubjects = [];

    incorrectQuestions = [];
    isReviewMode = isReview;
    isCheckedQuestionsMode = isChecked;

    if (quizQuestions && Array.isArray(quizQuestions)) {
        quizToStart = quizQuestions;
        if (quizToStart.length > 0) {
            selectedRound = quizToStart[0]['연월일'];
            selectedSubjects = [...new Set(quizToStart.map(q => q['과목']))];
        }
    } else {
        selectedRound = document.getElementById('round-select').value;
        selectedSubjects = Array.from(document.querySelectorAll('input[name="subject"]:checked'))
            .map(cb => cb.value);

        if (!selectedRound) {
            alert('회차를 선택해주세요.');
            return;
        }
        if (selectedSubjects.length === 0) {
            alert('과목을 하나 이상 선택해주세요.');
            return;
        }
        
        quizToStart = allQuizData.filter(q =>
            q['연월일'] === selectedRound && selectedSubjects.includes(q['과목'])
        );
    }
    
    // ⭐ 수정: quizQuestions가 제공되면 isReview/isChecked 상태를 명확히 설정
    if (quizQuestions) {
        isReviewMode = isReview;
        isCheckedQuestionsMode = isChecked;
    }

    if (quizToStart.length === 0) {
        alert('선택한 조건에 해당하는 문제가 없습니다. 다른 회차나 과목을 선택해주세요.');
        const checkedQuizModal = document.getElementById('checked-quiz-modal');
        if (checkedQuizModal && checkedQuizModal.style.display === 'block') {
             checkedQuizModal.style.display = 'none';
        }
        showPage('main-page');
        return;
    }

    if (Array.isArray(quizToStart)) {
        // ⭐ 수정: 체크 문제 모드일 경우 정렬 기준 변경
        if (isCheckedQuestionsMode) {
            quizToStart.sort((a, b) => {
                // 연월일 순으로 먼저 정렬
                const roundComparison = a['연월일'].localeCompare(b['연월일']);
                if (roundComparison !== 0) {
                    return roundComparison;
                }
                // 연월일이 같으면 문제번호 순으로 정렬
                return parseInt(a['문제번호']) - parseInt(b['문제번호']);
            });
        } else {
            // 일반 퀴즈 모드일 경우 기존 정렬 유지 (문제번호 순)
            quizToStart.sort((a, b) => parseInt(a['문제번호']) - parseInt(b['문제번호']));
        }
    } else {
        console.error("오류: quizToStart가 배열이 아닙니다.", quizToStart);
        alert("퀴즈 문제를 불러오는 중 오류가 발생했습니다. 다시 시도해주세요.");
        showPage('main-page');
        return;
    }

    filteredQuizData = quizToStart;
    currentQuestionIndex = startFromIndex;
    score = 0;
    filteredQuizData.forEach(q => {
        q.answered = false;
        q.isCorrect = false;
    });

    showPage('quiz-page');
    if (currentQuestionIndex < filteredQuizData.length) {
        displayQuestion(filteredQuizData[currentQuestionIndex]);
    } else {
        alert('마지막 푼 회차의 모든 문제를 풀었습니다. 해당 회차의 첫 문제부터 다시 시작합니다.');
        currentQuestionIndex = 0;
        displayQuestion(filteredQuizData[currentQuestionIndex]);
    }

    // ⭐ 수정: 퀴즈 모드에 따라 다른 상태 저장 함수 호출
    if (isCheckedQuestionsMode) {
        saveLastCheckedQuizState(selectedSubjects, currentQuestionIndex);
    } else if (!isReviewMode) {
        saveLastQuizState(selectedRound, selectedSubjects, currentQuestionIndex);
    }
}

// 문제 표시 함수
function displayQuestion(question) {
    const quizQuestionEl = document.getElementById('question-content');
    const quizViewEl = document.getElementById('view-content');
    const quizViewImageEl = document.getElementById('view-image');
    const optionsContainer = document.getElementById('options-container');
    const explanationContainer = document.getElementById('explanation-container');
    const newExplanationInput = document.getElementById('new-explanation-input');
    const currentQuizInfoEl = document.getElementById('current-quiz-info');
    const nextButton = document.getElementById('next-button');
    const showAnswerButton = document.getElementById('show-answer-button');
    const questionCheckbox = document.getElementById('question-checkbox');
    const newExplanationSection = document.getElementById('new-explanation-section');
    const prevButton = document.getElementById('prev-button');

    optionsContainer.innerHTML = '';
    explanationContainer.innerHTML = '';
    explanationContainer.style.display = 'none';
    newExplanationSection.style.display = 'none';
    selectedOption = null;

    currentQuizInfoEl.textContent = `회차: ${question['연월일']} | 과목: ${question['과목']} | 문제번호: ${question['문제번호']}`;
    quizQuestionEl.textContent = question['문제내용'].replace(/_/g, ',');

    quizViewEl.textContent = '';
    quizViewEl.style.display = 'none';
    quizViewImageEl.src = '';
    quizViewImageEl.style.display = 'none';

    if (question['보기'] && question['보기'].trim() !== '') {
        const viewContent = question['보기'].trim();
        if (viewContent.startsWith('images/') && /\.(jpeg|jpg|gif|png|webp|svg)$/i.test(viewContent)) {
            quizViewImageEl.src = viewContent;
            quizViewImageEl.style.display = 'block';
        } else {
            quizViewEl.textContent = viewContent.replace(/_/g, ',');
            quizViewEl.style.display = 'block';
        }
    }

    questionCheckbox.checked = isQuestionChecked(question['연월일'], question['문제번호']);
    questionCheckbox.onchange = null;
    questionCheckbox.onchange = (event) => {
        if (event.target.checked) {
            saveCheckedQuestion(question['연월일'], question['문제번호']);
        } else {
            removeCheckedQuestion(question['연월일'], question['문제번호']);
        }
    };

    for (let i = 1; i <= 5; i++) {
        const optionKey = `선택지${i}`;
        const optionContent = question[optionKey];
        if (optionContent !== null && typeof optionContent !== 'undefined' && optionContent.trim() !== '') {
            const label = document.createElement('label');
            label.classList.remove('option-correct', 'option-wrong');
            label.setAttribute('for', `option-${i}`);

            const radioInput = document.createElement('input');
            radioInput.type = 'radio';
            radioInput.name = 'option';
            radioInput.value = i;
            radioInput.id = `option-${i}`;
            
            // ⭐ 수정된 부분: input을 label의 첫 번째 자식으로 추가
            label.appendChild(radioInput);

            label.addEventListener('click', function(event) {
                if (question.answered) return;
                
                radioInput.checked = true;
                selectedOption = parseInt(radioInput.value);
                
                optionsContainer.querySelectorAll('label').forEach(lbl => lbl.classList.remove('selected-option'));
                label.classList.add('selected-option');
                
                checkAnswer();
            });

            radioInput.addEventListener('change', function() {
                if (question.answered) return;
                selectedOption = parseInt(this.value);
                optionsContainer.querySelectorAll('label').forEach(lbl => lbl.classList.remove('selected-option'));
                this.parentElement.classList.add('selected-option');
                checkAnswer();
            });

            if (optionContent.startsWith('images/') && /\.(jpeg|jpg|gif|png|webp|svg)$/i.test(optionContent.trim())) {
                const img = document.createElement('img');
                img.src = optionContent.trim();
                img.alt = `선택지 ${i}`;
                img.classList.add('option-image');

                const optionNumberSpan = document.createTextNode(`${i}. `);
                label.appendChild(optionNumberSpan);
                label.appendChild(img);
            } else {
                const textNode = document.createTextNode(` ${i}. ${optionContent.replace(/_/g, ',')}`);
                label.appendChild(textNode);
            }
            optionsContainer.appendChild(label);
        }
    }

    nextButton.style.display = 'block';
    showAnswerButton.style.display = 'block';
    nextButton.textContent = '다음 문제';
    nextButton.disabled = true;

    if (prevButton) {
        prevButton.style.display = 'block';
        prevButton.disabled = (currentQuestionIndex === 0);
    }
    
    if (question.answered) {
        const correctAnswerNumber = parseCorrectAnswer(question['정답']);
        optionsContainer.querySelectorAll('label').forEach(label => {
            const input = label.querySelector('input[type="radio"]');
            if (!input) return;
            input.disabled = true;
            label.style.cursor = 'default';
            if (parseInt(input.value) === correctAnswerNumber) {
                label.classList.add('option-correct');
            } else if (parseInt(input.value) === selectedOption && selectedOption !== correctAnswerNumber) {
                label.classList.add('option-wrong');
            }
        });
        explanationContainer.innerHTML = `<p><strong>해설:</strong></p><p>${(question['해설'] || '해설이 없습니다.').replace(/_/g, ',')}</p>`;
        explanationContainer.style.display = 'block';
        newExplanationSection.style.display = 'block';
        showAnswerButton.style.display = 'none';
        nextButton.disabled = false;
    }

    newExplanationInput.value = getTemporaryExplanation(question['연월일'], question['문제번호']).replace(/_/g, ',');
    
    // ⭐ 수정: 퀴즈 모드에 따라 다른 상태 저장 함수 호출
    if (isCheckedQuestionsMode) {
        saveLastCheckedQuizState([...new Set(filteredQuizData.map(q => q['과목']))], currentQuestionIndex);
    } else if (!isReviewMode) {
        saveLastQuizState(question['연월일'], [...new Set(filteredQuizData.map(q => q['과목']))], currentQuestionIndex);
    }
}

function checkAnswer() {
    const currentQuestion = filteredQuizData[currentQuestionIndex];
    const options = document.querySelectorAll('#options-container label');
    const explanationContainer = document.getElementById('explanation-container');
    const newExplanationSection = document.getElementById('new-explanation-section');
    const nextButton = document.getElementById('next-button');
    const showAnswerButton = document.getElementById('show-answer-button');

    if (selectedOption === null) {
        nextButton.disabled = false;
        showAnswerButton.style.display = 'none';
        return;
    }
    
    options.forEach(label => {
        label.classList.remove('selected-option');
    });

    const correctAnswerNumber = parseCorrectAnswer(currentQuestion['정답']);
    let isCurrentQuestionCorrect = false;

    options.forEach(label => {
        const input = label.querySelector('input[type="radio"]');

        if (!input) return; 

        const optionValue = parseInt(input.value);

        input.disabled = true;
        label.style.cursor = 'default';
        label.classList.remove('option-correct', 'option-wrong');

        if (optionValue === correctAnswerNumber) {
            label.classList.add('option-correct');
            if (selectedOption === optionValue) {
                isCurrentQuestionCorrect = true;
            }
        } else if (selectedOption === optionValue) {
            label.classList.add('option-wrong');
        }
    });

    if (!currentQuestion.answered) {
        if (isCurrentQuestionCorrect) {
            score++;
            currentQuestion.isCorrect = true;
        } else {
            currentQuestion.isCorrect = false;
            const isAlreadyInIncorrect = incorrectQuestions.some(q =>
                q['연월일'] === currentQuestion['연월일'] &&
                q['과목'] === currentQuestion['과목'] &&
                q['문제번호'] === currentQuestion['문제번호']
            );
            if (!isReviewMode && !isAlreadyInIncorrect) {
                incorrectQuestions.push(currentQuestion);
            }
        }
        currentQuestion.answered = true;
    }

    explanationContainer.innerHTML = `<p><strong>해설:</strong></p><p>${(currentQuestion['해설'] || '해설이 없습니다.').replace(/_/g, ',')}</p>`;
    explanationContainer.style.display = 'block';
    newExplanationSection.style.display = 'block';

    nextButton.disabled = false;
    showAnswerButton.style.display = 'none';

    if (currentQuestionIndex === filteredQuizData.length - 1) {
        nextButton.textContent = '결과 보기';
    } else {
        nextButton.textContent = '다음 문제';
    }
}

function prevQuestion() {
    if (currentQuestionIndex > 0) {
        currentQuestionIndex--;
        displayQuestion(filteredQuizData[currentQuestionIndex]);
    } else {
        alert('현재가 첫 번째 문제입니다.');
    }
}

function nextQuestion() {
    const currentQuestion = filteredQuizData[currentQuestionIndex];

    if (!currentQuestion.answered) {
        alert('현재 문제를 먼저 풀이하거나 정답을 확인해주세요.');
        return;
    }

    currentQuestionIndex++;
    if (currentQuestionIndex < filteredQuizData.length) {
        displayQuestion(filteredQuizData[currentQuestionIndex]);
    } else {
        // ⭐ 수정: 모든 퀴즈가 끝나면 결과 페이지로 이동
        showResult();
    }
}

function showAnswer() {
    const currentQuestion = filteredQuizData[currentQuestionIndex];
    const options = document.querySelectorAll('#options-container label');
    const explanationContainer = document.getElementById('explanation-container');
    const newExplanationSection = document.getElementById('new-explanation-section');
    const showAnswerButton = document.getElementById('show-answer-button');
    const nextButton = document.getElementById('next-button');

    const correctAnswerNumber = parseCorrectAnswer(currentQuestion['정답']);

    options.forEach(label => {
        const input = label.querySelector('input[type="radio"]');
        if (!input) return;
        input.disabled = true;
        label.style.cursor = 'default';
        label.classList.remove('option-correct', 'option-wrong');
    });

    if (correctAnswerNumber !== null) {
        options.forEach(label => {
            const input = label.querySelector('input[type="radio"]');
            if (!input) return;
            const optionValue = parseInt(input.value);
            if (optionValue === correctAnswerNumber) {
                label.classList.add('option-correct');
            }
        });
    }

    explanationContainer.innerHTML = `<p><strong>해설:</strong></p><p>${(currentQuestion['해설'] || '해설이 없습니다.').replace(/_/g, ',')}</p>`;
    explanationContainer.style.display = 'block';
    newExplanationSection.style.display = 'block';

    showAnswerButton.style.display = 'none';
    nextButton.disabled = false;

    if (!currentQuestion.answered) {
        currentQuestion.answered = true;
        currentQuestion.isCorrect = false;

        const isAlreadyInIncorrect = incorrectQuestions.some(q =>
            q['연월일'] === currentQuestion['연월일'] &&
            q['과목'] === currentQuestion['과목'] &&
            q['문제번호'] === currentQuestion['문제번호']
        );
        if (!isReviewMode && !isAlreadyInIncorrect) {
            incorrectQuestions.push(currentQuestion);
        }
    }

    if (currentQuestionIndex === filteredQuizData.length - 1) {
        nextButton.textContent = '결과 보기';
    } else {
        nextButton.textContent = '다음 문제';
    }
}

function showResult() {
    const scoreDisplay = document.getElementById('score-display');
    const totalQuestions = filteredQuizData.length;
    scoreDisplay.textContent = `${totalQuestions}문제 중 ${score}개 정답! (${(score / totalQuestions * 100).toFixed(1)}%)`;

    const nextRoundButton = document.getElementById('next-round-button');
    const reviewIncorrectButton = document.getElementById('review-incorrect-button');

    // ⭐ 수정: 체크 문제 풀이 모드에서는 '다음 회차' 버튼을 숨깁니다.
    if (isCheckedQuestionsMode) {
        nextRoundButton.style.display = 'none';
    } else {
        const currentRound = filteredQuizData.length > 0 ? filteredQuizData[0]['연월일'] : null;
        const currentRoundIndex = rounds.indexOf(currentRound);
        if (currentRoundIndex !== -1 && currentRoundIndex < rounds.length - 1) {
            nextRoundButton.style.display = 'inline-block';
        } else {
            nextRoundButton.style.display = 'none';
        }
    }

    if (incorrectQuestions.length > 0) {
        reviewIncorrectButton.style.display = 'inline-block';
    } else {
        reviewIncorrectButton.style.display = 'none';
    }

    document.getElementById('back-to-main-from-result-button').style.display = 'inline-block';

    showPage('result-page');

    if (isCheckedQuestionsMode) {
        clearLastCheckedQuizState();
    } else {
        clearLastQuizState();
    }
}

function startNextRoundQuiz(fromResultPage = false) {
    const currentRound = filteredQuizData.length > 0 ? filteredQuizData[0]['연월일'] : null;
    const currentRoundIndex = rounds.indexOf(currentRound);

    if (currentRoundIndex !== -1 && currentRoundIndex < rounds.length - 1) {
        const nextRound = rounds[currentRoundIndex + 1];

        const subjectsForNextRound = [...new Set(filteredQuizData.map(q => q['과목']))];

        const nextRoundQuestions = allQuizData.filter(q =>
            q['연월일'] === nextRound && subjectsForNextRound.includes(q['과목'])
        );

        if (nextRoundQuestions.length > 0) {
            startQuiz(nextRoundQuestions, false, false);
        } else {
            alert(`다음 회차 (${nextRound})에 이전에 선택했던 과목의 문제가 없습니다.`);
            showPage('main-page');
        }
    } else {
        alert('다음 회차가 없습니다.');
        showPage('main-page');
    }
}

function startIncorrectQuiz() {
    if (incorrectQuestions.length > 0) {
        incorrectQuestions.forEach(q => {
            q.answered = false;
            q.isCorrect = false;
        });
        startQuiz(incorrectQuestions, true, false);
    } else {
        alert('틀린 문제가 없습니다.');
        showPage('main-page');
    }
}

function startCheckedQuiz() {
    const checkedQuizModal = document.getElementById('checked-quiz-modal');
    if (checkedQuizModal) {
        checkedQuizModal.style.display = 'flex';
        const checkedSubjectCheckboxes = document.querySelectorAll('#checked-subject-checkboxes-container .subject-checkboxes-wrapper input[name="checkedSubject"]');
        checkedSubjectCheckboxes.forEach(cb => cb.checked = false);
        const toggleCheckedSubjectsButton = document.getElementById('toggle-all-checked-subjects-button');
        if (toggleCheckedSubjectsButton) {
            toggleCheckedSubjectsButton.textContent = '전체 선택';
        }
        updateContinueLastCheckedQuizButton();
    }
}

function startCheckedQuizWithSubject() {
    selectedSubjectsForCheckedQuiz = Array.from(document.querySelectorAll('#checked-subject-checkboxes-container .subject-checkboxes-wrapper input[name="checkedSubject"]:checked'))
        .map(cb => cb.value);

    if (selectedSubjectsForCheckedQuiz.length === 0) {
        alert('체크 문제 풀이할 과목을 하나 이상 선택해주세요.');
        return;
    }
    
    clearLastCheckedQuizState();

    const checkedQuestionsKeys = getCheckedQuestions();
    let checkedQuestionsArray = [];

    for (const q of allQuizData) {
        const key = `${q['연월일']}-${q['문제번호']}`;
        if (checkedQuestionsKeys[key] && selectedSubjectsForCheckedQuiz.includes(q['과목'])) {
            checkedQuestionsArray.push(q);
        }
    }

    if (checkedQuestionsArray.length > 0) {
        const checkedQuizModal = document.getElementById('checked-quiz-modal');
        if (checkedQuizModal) {
            checkedQuizModal.style.display = 'none';
        }
        checkedQuestionsArray.forEach(q => {
            q.answered = false;
            q.isCorrect = false;
        });
        
        checkedQuestionsArray.sort((a, b) => {
            const roundComparison = a['연월일'].localeCompare(b['연월일']);
            if (roundComparison !== 0) {
                return roundComparison;
            }
            return parseInt(a['문제번호']) - parseInt(b['문제번호']);
        });

        startQuiz(checkedQuestionsArray, false, true);
    } else {
        alert('선택한 과목에 해당하는 체크된 문제가 없습니다. 다른 과목을 선택하거나 문제를 체크해주세요.');
    }
}

function continueLastQuiz() {
    const lastState = getLastQuizState();
    if (lastState) {
        const { round, subjects, questionIndex } = lastState;

        const questionsToContinue = allQuizData.filter(q =>
            q['연월일'] === round && subjects.includes(q['과목'])
        );

        if (questionsToContinue.length > 0) {
            const startIndex = questionIndex;

            if (startIndex < questionsToContinue.length) {
                startQuiz(questionsToContinue, false, false, startIndex);
            } else {
                alert('마지막 푼 회차의 모든 문제를 풀었습니다. 해당 회차의 첫 문제부터 다시 시작합니다.');
                startQuiz(questionsToContinue, false, false, 0);
            }
        } else {
            alert('마지막으로 푼 문제의 데이터를 찾을 수 없습니다. 처음부터 다시 시작해주세요.');
            clearLastQuizState();
            showPage('main-page');
        }
    } else {
        alert('마지막 푼 문제가 없습니다. 새로운 퀴즈를 시작해주세요.');
        showPage('main-page');
    }
}

function continueLastCheckedQuiz() {
    const lastState = getLastCheckedQuizState();
    if (lastState) {
        const { subjects, questionIndex } = lastState;
        
        const checkedQuestionsKeys = getCheckedQuestions();
        const questionsToContinue = allQuizData.filter(q => {
            const key = `${q['연월일']}-${q['문제번호']}`;
            return checkedQuestionsKeys[key] && subjects.includes(q['과목']);
        });

        if (questionsToContinue.length > 0) {
            const startIndex = questionIndex;
            if (startIndex < questionsToContinue.length) {
                const checkedQuizModal = document.getElementById('checked-quiz-modal');
                if (checkedQuizModal) {
                    checkedQuizModal.style.display = 'none';
                }
                questionsToContinue.forEach(q => {
                    q.answered = false;
                    q.isCorrect = false;
                });
                
                questionsToContinue.sort((a, b) => {
                    const roundComparison = a['연월일'].localeCompare(b['연월일']);
                    if (roundComparison !== 0) {
                        return roundComparison;
                    }
                    return parseInt(a['문제번호']) - parseInt(b['문제번호']);
                });
                
                startQuiz(questionsToContinue, false, true, startIndex);
            } else {
                alert('마지막 푼 체크 문제의 모든 문제를 완료했습니다. 첫 번째 문제부터 다시 시작합니다.');
                startQuiz(questionsToContinue, false, true, 0);
            }
        } else {
            alert('마지막으로 푼 체크 문제의 데이터를 찾을 수 없습니다. 다시 과목을 선택해주세요.');
            clearLastCheckedQuizState();
            showPage('main-page');
        }
    } else {
        alert('마지막으로 푼 체크 문제가 없습니다. 새로운 퀴즈를 시작해주세요.');
        showPage('main-page');
    }
}

function copyQuestionContent() {
    const currentQuestion = filteredQuizData[currentQuestionIndex];
    if (!currentQuestion) {
        alert('현재 문제 정보가 없어 복사할 수 없습니다.');
        return;
    }
    const questionContent = currentQuestion['문제내용'].replace(/_/g, ',');

    let viewContentFormatted = '';
    if (currentQuestion['보기'] && currentQuestion['보기'].trim() !== '') {
        const viewData = currentQuestion['보기'].trim();
        if (viewData.startsWith('images/') && /\.(jpeg|jpg|gif|png|webp|svg)$/i.test(viewData)) {
            viewContentFormatted = `[보기 이미지: ${window.location.origin}/${viewData}]`;
        } else {
            viewContentFormatted = viewData.replace(/_/g, ',');
        }
    }

    let optionsText = '';
    for (let i = 1; i <= 5; i++) {
        const optionKey = `선택지${i}`;
        const optionData = currentQuestion[optionKey];
        if (optionData !== null && typeof optionData !== 'undefined' && optionData.trim() !== '') {
            if (optionData.startsWith('images/') && /\.(jpeg|jpg|gif|png|webp|svg)$/i.test(optionData.trim())) {
                optionsText += `${i}. [선택지 이미지: ${window.location.origin}/${optionData.trim()}]\n`;
            } else {
                optionsText += `${i}. ${optionData.replace(/_/g, ',')}\n`;
            }
        }
    }

    const fullContent = `[${currentQuestion['연월일']}-${currentQuestion['문제번호']}번] ${questionContent}` +
        (viewContentFormatted ? '\n\n<보기>\n' + viewContentFormatted : '') +
        (optionsText ? '\n\n' + optionsText.trim() : '');

    navigator.clipboard.writeText(fullContent)
        .then(() => {
            alert('문제 내용이 클립보드에 복사되었습니다.');
        })
        .catch(err => {
            console.error('클립보드 복사 실패:', err);
            alert('클립보드 복사에 실패했습니다. 브라우저 설정을 확인해주세요.');
        });
}

function exportCheckedQuestions() {
    const checkedQuestions = getCheckedQuestions();
    const dataToExport = JSON.stringify(checkedQuestions, null, 2);

    if (Object.keys(checkedQuestions).length === 0) {
        alert('체크된 문제가 없습니다.');
        return;
    }

    navigator.clipboard.writeText(dataToExport)
        .then(() => {
            alert('체크된 문제 목록이 클립보드에 복사되었습니다.');
        })
        .catch(err => {
            console.error('클립보드 복사 실패:', err);
            alert('클립보드 복사에 실패했습니다. 브라우저 설정을 확인해주세요.');
        });
}

function importCheckedQuestions() {
    const fileInput = document.getElementById('import-checked-file-input');
    if (fileInput) {
        fileInput.click();
    } else {
        const jsonString = prompt('여기에 체크된 문제 JSON 데이터를 붙여넣으세요:\n(기존 데이터에 덮어씌워집니다.)');
        if (jsonString) {
            processImportedCheckedQuestions(jsonString);
        }
    }
}

function processImportedCheckedQuestions(jsonString) {
    try {
        const importedData = JSON.parse(jsonString);

        if (typeof importedData !== 'object' || Array.isArray(importedData)) {
            throw new Error('가져온 데이터가 유효한 JSON 객체 형식이 아닙니다.');
        }

        if (confirm('기존 체크된 문제를 가져온 데이터로 덮어씌우시겠습니까? (취소 시 병합됩니다)')) {
            localStorage.setItem(CHECKED_QUESTIONS_KEY, JSON.stringify(importedData));
            alert('체크된 문제가 성공적으로 덮어씌워졌습니다.');
        } else {
            const existingChecked = getCheckedQuestions();
            const mergedData = { ...existingChecked, ...importedData };
            localStorage.setItem(CHECKED_QUESTIONS_KEY, JSON.stringify(mergedData));
            alert('체크된 문제가 성공적으로 병합되었습니다.');
        }

        populateCheckedQuizSubjectSelection();
        updateContinueLastQuizButton();
        updateContinueLastCheckedQuizButton();
    } catch (e) {
        alert('잘못된 JSON 형식의 데이터입니다. 데이터를 확인해주세요.\n오류: ' + e.message);
        console.error('체크된 문제 가져오기 오류:', e);
    }
}

function setupEventListeners() {
    document.getElementById('start-quiz-button').addEventListener('click', () => startQuiz());
    document.getElementById('start-checked-quiz-button').addEventListener('click', startCheckedQuiz);

    const checkedQuizModal = document.getElementById('checked-quiz-modal');
    if (checkedQuizModal) {
        document.getElementById('confirm-checked-quiz-start').addEventListener('click', startCheckedQuizWithSubject);
        
        const continueCheckedQuizButton = document.getElementById('continue-last-checked-quiz-button');
        if (continueCheckedQuizButton) {
            continueCheckedQuizButton.addEventListener('click', continueLastCheckedQuiz);
        }
        
        const closeButton = checkedQuizModal.querySelector('.close-button');
        if (closeButton) {
            closeButton.addEventListener('click', () => {
                checkedQuizModal.style.display = 'none';
            });
        }
        window.addEventListener('click', (event) => {
            if (event.target === checkedQuizModal) {
                checkedQuizModal.style.display = 'none';
            }
        });
    }

    const continueLastQuizButton = document.getElementById('continue-last-quiz-button');
    if(continueLastQuizButton) {
      continueLastQuizButton.addEventListener('click', continueLastQuiz);
    }

    document.getElementById('next-button').addEventListener('click', nextQuestion);
    document.getElementById('show-answer-button').addEventListener('click', showAnswer);
    document.getElementById('copy-question-button').addEventListener('click', copyQuestionContent);
    
    const prevButton = document.getElementById('prev-button');
    if (prevButton) {
        prevButton.addEventListener('click', prevQuestion);
    }
    
    document.getElementById('back-to-main-button').addEventListener('click', () => {
        populateMainPage();
        showPage('main-page');
        updateContinueLastQuizButton();
        updateContinueLastCheckedQuizButton(); // ⭐ 수정: 체크 퀴즈 상태 버튼도 갱신
    });

    document.getElementById('next-round-button').addEventListener('click', () => startNextRoundQuiz(true));
    document.getElementById('review-incorrect-button').addEventListener('click', startIncorrectQuiz);
    document.getElementById('back-to-main-from-result-button').addEventListener('click', () => {
        populateMainPage();
        showPage('main-page');
        updateContinueLastQuizButton();
        updateContinueLastCheckedQuizButton(); // ⭐ 수정: 체크 퀴즈 상태 버튼도 갱신
    });

    document.getElementById('toggle-all-subjects-button').addEventListener('click', toggleAllSubjects);

    document.getElementById('save-explanation-button').addEventListener('click', saveTemporaryExplanation);
    document.getElementById('export-explanations-button').addEventListener('click', exportTemporaryExplanations);
    document.getElementById('clear-temp-explanations-button').addEventListener('click', clearTemporaryExplanations);
    
    const exportCheckedButton = document.getElementById('export-checked-questions-button');
    if (exportCheckedButton) {
        exportCheckedButton.addEventListener('click', exportCheckedQuestions);
    }

    const importCheckedButton = document.getElementById('import-checked-questions-button');
    if (importCheckedButton) {
        importCheckedButton.addEventListener('click', importCheckedQuestions);
    }

    const importFileInput = document.getElementById('import-checked-file-input');
    if (importFileInput) {
        importFileInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    processImportedCheckedQuestions(e.target.result);
                };
                reader.readAsText(file);
            }
        });
    }
}