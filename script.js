/* ============================================================================
 * HumanPhys 项目主页 — 交互脚本
 *   ① 排行榜排序 + 名次自动重排
 *   ② 任务定义:左侧目录跳转 + 滚动跟随高亮
 *   ③ Case Study 互动评分演示
 *   ④ 图片轮播(当前页面未使用,保留以便将来加图库;无 .image-slider 时自动跳过)
 *   全部原生 JS,无第三方依赖,file:// 直接打开即可运行
 * ==========================================================================*/

/* ══════════════════════════════════════════════════════════════════════════
 * ★ Case Study 题库
 *   全部数据取自论文原文与 Demo 图(Figure 5),非杜撰:
 *     gold      = [["yaw", -27], ["+X", 0.2]]
 *     predicted = [["yaw", -30], ["+X", 0.2]]      (GPT-6-Sol)
 *     Step1 共享轴向但幅度不同 -> 通过 10 个 MRA 阈值中的 8 个 -> 0.8
 *     Step2 完全一致                                      -> 1.0
 *     序列分 = (0.8 + 1.0) / 2 = 0.9
 *
 *   tabLabel    : 选项卡名字(HTML 实体会被解析)
 *   tabIcon     : Font Awesome 图标类
 *   question    : 题干
 *   options     : 选项文本(顺序即 A/B/C/D)
 *   correct     : 正确项下标(0 = A)
 *   explanation : 作答后展示的解析
 *   ══════════════════════════════════════════════════════════════════════════ */
const QUIZ_ITEMS = [
    {
        tabLabel : 'The item',
        tabIcon  : 'fas fa-cube',
        question : 'In the <em>CP-Room</em> sub-task, every frame transition is exactly one <em>atomic action</em>. What must the model output for each subsequent frame?',
        options  : [
            'One atomic action: a lattice translation or an in-place rotation',
            'A 3D bounding box for each visible object',
            'A depth value for every pixel',
            'A free-form sentence describing the scene'
        ],
        correct  : 0,
        explanation: 'The action grammar is fixed: a translation along &plusmn;X/&plusmn;Y/&plusmn;Z by 1&ndash;3 steps (0.20&nbsp;m each), or an in-place yaw/pitch/roll rotation of &plusmn;1&deg;&ndash;&plusmn;30&deg;. The answer is a sequence of such actions, one per frame.'
    },
    {
        tabLabel : 'Step 1',
        tabIcon  : 'fas fa-rotate',
        question : 'Step&nbsp;1 of the gold answer is <code>["yaw", -27]</code>; GPT-6-Sol predicted <code>["yaw", -30]</code>. The axis is right but the magnitude differs. Under the scorer\'s MRA threshold set <em>C&nbsp;=&nbsp;{0.50,&nbsp;0.55,&nbsp;&hellip;,&nbsp;0.95}</em>, how much credit does this step earn?',
        options  : ['0 / 10 = 0.0', '5 / 10 = 0.5', '8 / 10 = 0.8', '10 / 10 = 1.0'],
        correct  : 2,
        explanation: '<code>|&#375;&nbsp;&minus;&nbsp;y| / |y| = |30&nbsp;&minus;&nbsp;27| / 27 &asymp; 0.111</code>. A threshold &theta; is passed when that relative error is below <code>1&nbsp;&minus;&nbsp;&theta;</code>, i.e. when &theta;&nbsp;&lt;&nbsp;0.889 &mdash; satisfied by the eight thresholds up to 0.85, giving <strong>8/10 = 0.8</strong>. That is the partial credit the MRA rule is designed to grant.'
    },
    {
        tabLabel : 'Final score',
        tabIcon  : 'fas fa-calculator',
        question : 'Step&nbsp;2 is <code>["+X", 0.2]</code> in both gold and prediction &mdash; an exact match, worth 1.0. The sequence score averages over the gold step count: <em>(step&nbsp;1 + step&nbsp;2) / 2</em>. What is the final score?',
        options  : ['0.80', '0.85', '0.90', '1.00'],
        correct  : 2,
        explanation: '<code>(0.8 + 1.0) / 2 = <strong>0.9</strong></code>. Note what this means for the benchmark: a model that gets the <em>motion type</em> right but the magnitude wrong still keeps 80% of the credit on that step &mdash; which is exactly why the paper\'s diagnosis attributes 92.2% of the loss on CP-Room to wrong axis / motion type and only 2.2% to magnitude.'
    }
];

/* ══════════════════════════════════════════════════════════════════════════
 * ★ 轮播行为(当前页面无 .image-slider,加图库时生效)
 * ══════════════════════════════════════════════════════════════════════════ */
const SLIDER_AUTOPLAY = true;
const AUTO_INTERVAL   = 3000;

/* ══════════════════════════════════════════════════════════════════════════
 * ★ 排行榜排序配置
 * ══════════════════════════════════════════════════════════════════════════ */
const RANK_START_COLUMN    = 2;      // 默认按哪一列排序(2 = Overall)
const RANK_START_ASCENDING = false;  // 默认降序(分数高的在前)


/* ══════════════════════════════════════════════════════════════════════════
 * ① 排行榜:点击表头排序 + 自动重排名次
 * ══════════════════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', function () {
    const table = document.getElementById('leaderboard');
    if (!table) return;

    const tbody   = table.querySelector('tbody');
    const headers = table.querySelectorAll('th.sortable');
    let currentSort = { column: RANK_START_COLUMN, ascending: RANK_START_ASCENDING };

    /* 取排序值:方法列取链接文本(忽略 closed/open 徽章),其余取数值 */
    function getCellValue(row, colIndex) {
        const cell = row.cells[colIndex];
        if (!cell) return -Infinity;

        if (colIndex === 1) {
            const anchor = cell.querySelector('a');
            const text = (anchor ? anchor.textContent : cell.textContent) || '';
            return text.trim().toLowerCase();
        }

        const raw = (cell.textContent || '').trim();
        const value = parseFloat(raw);
        return isNaN(value) ? raw.toLowerCase() : value;
    }

    /* 重排名次:第 1 列写回 1..n */
    function updateRanks() {
        Array.prototype.forEach.call(tbody.rows, function (row, index) {
            if (row.cells[0]) row.cells[0].textContent = index + 1;
        });
    }

    function sortTable(colIndex, ascending) {
        const rows = Array.prototype.slice.call(tbody.rows);
        rows.sort(function (rowA, rowB) {
            const valA = getCellValue(rowA, colIndex);
            const valB = getCellValue(rowB, colIndex);

            if (typeof valA === 'string' && typeof valB === 'string') {
                return ascending ? valA.localeCompare(valB) : valB.localeCompare(valA);
            }
            const comparison = valA > valB ? 1 : (valA < valB ? -1 : 0);
            return ascending ? comparison : -comparison;
        });
        rows.forEach(function (row) { tbody.appendChild(row); });
    }

    function updateSortIndicators() {
        Array.prototype.forEach.call(headers, function (header) {
            const indicator = header.querySelector('.sort-indicator');
            if (!indicator) return;
            indicator.textContent =
                parseInt(header.dataset.columnIndex, 10) === currentSort.column
                    ? (currentSort.ascending ? '▲' : '▼')
                    : '';
        });
    }

    Array.prototype.forEach.call(headers, function (header) {
        header.addEventListener('click', function () {
            const colIndex = parseInt(header.dataset.columnIndex, 10);
            if (currentSort.column === colIndex) {
                currentSort.ascending = !currentSort.ascending;
            } else {
                currentSort.column = colIndex;
                currentSort.ascending = (colIndex === 1);   // 方法列升序,数值列降序
            }
            sortTable(currentSort.column, currentSort.ascending);
            updateSortIndicators();
            updateRanks();
        });
    });

    sortTable(currentSort.column, currentSort.ascending);
    updateSortIndicators();
    updateRanks();
});


/* ══════════════════════════════════════════════════════════════════════════
 * ② 任务定义:左侧目录跳转 + 滚动跟随高亮
 *
 *   ★ 跳转交给浏览器原生锚点(<a href="#td-xxx">),不用 scrollIntoView —
 *     原生锚点是所有浏览器都保证生效的机制;JS 只负责切换高亮,
 *     平滑滚动由 CSS 的 scroll-behavior: smooth 提供。
 *   ══════════════════════════════════════════════════════════════════════════ */
(function initTaskNav() {
    const nav = document.querySelector('.taskdef-nav');
    if (!nav) return;

    const links = Array.prototype.slice.call(nav.querySelectorAll('a[href^="#"]'));
    const targets = links
        .map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); })
        .filter(Boolean);
    if (!targets.length) return;

    function activate(id) {
        links.forEach(function (a) {
            a.classList.toggle('on', a.getAttribute('href') === '#' + id);
        });
    }

    /* 点击:不拦截默认行为,让浏览器自己跳;这里只把高亮切到该项 */
    links.forEach(function (a) {
        a.addEventListener('click', function () {
            activate(a.getAttribute('href').slice(1));
        });
    });

    /* 滚动时高亮跟随:最后一个「顶部已越过视口 30% 线」的区块即当前区块 */
    function onScroll() {
        const line = window.innerHeight * 0.3;
        let current = targets[0];
        targets.forEach(function (t) {
            if (t.getBoundingClientRect().top <= line) current = t;
        });
        activate(current.id);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);

    /* 带 #hash 直接打开时,先按 hash 同步一次 */
    window.addEventListener('load', function () {
        const h = location.hash.slice(1);
        if (h && document.getElementById(h)) activate(h); else onScroll();
    });

    onScroll();
})();


/* ══════════════════════════════════════════════════════════════════════════
 * ③ Case Study 互动评分演示
 * ══════════════════════════════════════════════════════════════════════════ */
(function initQuiz() {
    const tabsRoot    = document.getElementById('quiz-tabs');
    const contentRoot = document.getElementById('tab-content');
    if (!tabsRoot || !contentRoot) return;

    /* 选项卡按钮 */
    tabsRoot.innerHTML = QUIZ_ITEMS.map(function (item, index) {
        return '<button class="tab-button" type="button" data-index="' + index + '">' +
                   '<i class="' + item.tabIcon + '"></i> ' + item.tabLabel +
               '</button>';
    }).join('');

    function showTab(index) {
        const item = QUIZ_ITEMS[index];

        const optionsHTML = item.options.map(function (option, i) {
            return '<li><button type="button" data-question="' + index + '" data-option="' + i + '">' +
                       '<span class="option-label">' + String.fromCharCode(65 + i) + '</span>' +
                       '<span class="option-text">' + option + '</span>' +
                   '</button></li>';
        }).join('');

        contentRoot.innerHTML =
            '<div class="quiz-question">' +
                '<p>' + item.question + '</p>' +
                '<ul class="quiz-options">' + optionsHTML + '</ul>' +
                '<p class="quiz-feedback" id="quiz-feedback-' + index + '"></p>' +
            '</div>';

        const buttons = tabsRoot.querySelectorAll('.tab-button');
        Array.prototype.forEach.call(buttons, function (btn, i) {
            btn.classList.toggle('active', i === index);
        });
    }

    function checkAnswer(questionIndex, selectedIndex, buttonEl) {
        const item = QUIZ_ITEMS[questionIndex];
        const feedback = document.getElementById('quiz-feedback-' + questionIndex);
        if (!feedback) return;

        const isRight = selectedIndex === item.correct;
        const options = buttonEl.closest('.quiz-options');

        Array.prototype.forEach.call(options.querySelectorAll('button'), function (btn) {
            btn.classList.remove('correct', 'wrong');
            btn.disabled = true;
        });
        buttonEl.classList.add(isRight ? 'correct' : 'wrong');
        if (!isRight) {
            const rightBtn = options.querySelector('button[data-option="' + item.correct + '"]');
            if (rightBtn) rightBtn.classList.add('correct');
        }

        feedback.innerHTML =
            (isRight
                ? "<span style='color:#1a7f37;'>Correct.</span>"
                : "<span style='color:#c0392b;'>Not quite.</span>") +
            "<br><span class='feedback-explain'>" + item.explanation + "</span>";
    }

    tabsRoot.addEventListener('click', function (e) {
        const btn = e.target.closest('.tab-button');
        if (!btn) return;
        showTab(parseInt(btn.dataset.index, 10));
    });

    contentRoot.addEventListener('click', function (e) {
        const btn = e.target.closest('button[data-question]');
        if (!btn || btn.disabled) return;
        checkAnswer(
            parseInt(btn.dataset.question, 10),
            parseInt(btn.dataset.option, 10),
            btn
        );
    });

    showTab(0);
})();


/* ══════════════════════════════════════════════════════════════════════════
 * ④ 图片轮播(页面无 .image-slider 时整体跳过)
 * ══════════════════════════════════════════════════════════════════════════ */
(function initSlider() {
    const slider = document.querySelector('.image-slider');
    if (!slider) return;

    const slides   = slider.querySelectorAll('.slide');
    const total    = slides.length;
    const dotsRoot = slider.querySelector('.slider-dots');
    let current    = 0;
    let timer      = null;

    if (total === 0) return;

    if (dotsRoot) {
        dotsRoot.innerHTML = Array.prototype.map.call(slides, function (_, i) {
            return '<span data-index="' + i + '"></span>';
        }).join('');
    }

    function showSlide(index) {
        current = (index + total) % total;
        Array.prototype.forEach.call(slides, function (slide, i) {
            slide.classList.toggle('active', i === current);
        });
        if (dotsRoot) {
            Array.prototype.forEach.call(dotsRoot.children, function (dot, i) {
                dot.classList.toggle('active', i === current);
            });
        }
    }

    function nextSlide() { showSlide(current + 1); }
    function prevSlide() { showSlide(current - 1); }

    function startAuto() {
        if (!SLIDER_AUTOPLAY || total < 2 || timer) return;
        timer = setInterval(nextSlide, AUTO_INTERVAL);
    }
    function stopAuto() {
        clearInterval(timer);
        timer = null;
    }

    const prevBtn = slider.querySelector('.prev-button');
    const nextBtn = slider.querySelector('.next-button');
    if (prevBtn) prevBtn.addEventListener('click', function () { stopAuto(); prevSlide(); startAuto(); });
    if (nextBtn) nextBtn.addEventListener('click', function () { stopAuto(); nextSlide(); startAuto(); });

    if (dotsRoot) {
        dotsRoot.addEventListener('click', function (e) {
            const dot = e.target.closest('span[data-index]');
            if (!dot) return;
            stopAuto();
            showSlide(parseInt(dot.dataset.index, 10));
            startAuto();
        });
    }

    slider.addEventListener('mouseenter', stopAuto);
    slider.addEventListener('mouseleave', startAuto);

    let touchStartX = null;
    slider.addEventListener('touchstart', function (e) {
        touchStartX = e.changedTouches[0].clientX;
        stopAuto();
    }, { passive: true });
    slider.addEventListener('touchend', function (e) {
        if (touchStartX === null) return;
        const dx = e.changedTouches[0].clientX - touchStartX;
        if (Math.abs(dx) > 40) { dx < 0 ? nextSlide() : prevSlide(); }
        touchStartX = null;
        startAuto();
    }, { passive: true });

    showSlide(0);
    startAuto();
})();
