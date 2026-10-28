
"use strict";

/* =========================================
   KNOW YOUR CASH
   ========================================= */

const DROP_VALUE = 300000;

const $ = (selector) => document.querySelector(selector);

const pumpForm = $("#pump-form");
const pumpStep = $("#pump-step");
const cashStep = $("#cash-step");
const reportStep = $("#report-step");

const messageBox = $("#message");

const pumpNumberInput = $("#pump-no");
const pmsPriceInput = $("#pms-price");
const agoPriceInput = $("#ago-price");

const usePms = $("#use-pms");
const useAgo = $("#use-ago");

const pmsFields = $("#pms-fields");
const agoFields = $("#ago-fields");

const dropsInput = $("#drops");
const transactionInput = $("#txn");

const pumpList = $("#pump-list");
const transactionList = $("#transaction-list");

const pumpCount = $("#pump-count");
const transactionCount = $("#txn-count");

const dropsTotal = $("#drops-total");
const transactionTotal = $("#txn-total");

let pumps = [];
let transactions = [];
let finished = false;

/* =========================================
   1. GENERAL HELPERS
   ========================================= */

function money(amount) {
    return "UGX " + Math.round(amount).toLocaleString("en-UG");
}

function litres(amount) {
    return amount.toLocaleString("en-UG", {
        maximumFractionDigits: 3
    }) + " L";
}

function showMessage(message, type = "success") {
    messageBox.textContent = message;
    messageBox.className =
        type === "error" ? "message error" : "message";

    messageBox.hidden = false;

    messageBox.scrollIntoView({
        behavior: "smooth",
        block: "nearest"
    });
}

function clearMessage() {
    messageBox.hidden = true;
    messageBox.textContent = "";
}

function makeElement(tag, text, className = "") {
    const element = document.createElement(tag);

    element.textContent = text;

    if (className) {
        element.className = className;
    }

    return element;
}

function setButtonState(button, disabled) {
    button.disabled = disabled;
}

/* =========================================
   2. SHOW SELECTED FUEL FIELDS
   ========================================= */

function updateFuelSelection() {
    pmsFields.hidden = !usePms.checked;
    agoFields.hidden = !useAgo.checked;

    $("#pms-opening").disabled = !usePms.checked;
    $("#pms-closing").disabled = !usePms.checked;

    $("#ago-opening").disabled = !useAgo.checked;
    $("#ago-closing").disabled = !useAgo.checked;

    pmsPriceInput.disabled = !usePms.checked;
    agoPriceInput.disabled = !useAgo.checked;

    if (!usePms.checked) {
        $("#pms-opening").value = "";
        $("#pms-closing").value = "";
    }

    if (!useAgo.checked) {
        $("#ago-opening").value = "";
        $("#ago-closing").value = "";
    }
}

usePms.addEventListener("change", () => {
    updateFuelSelection();
    clearMessage();
});

useAgo.addEventListener("change", () => {
    updateFuelSelection();
    clearMessage();
});

updateFuelSelection();

/* =========================================
   3. VALIDATE AND READ A FUEL METER
   ========================================= */

function readFuel(openingId, closingId, priceInput, fuelName) {
    const openingInput = $(openingId);
    const closingInput = $(closingId);

    if (
        openingInput.value.trim() === "" ||
        closingInput.value.trim() === ""
    ) {
        throw new Error(
            `${fuelName}: Enter both opening and closing readings.`
        );
    }

    if (priceInput.value.trim() === "") {
        throw new Error(
            `${fuelName}: Enter the selling price per litre.`
        );
    }

    const opening = Number(openingInput.value);
    const closing = Number(closingInput.value);
    const price = Number(priceInput.value);

    if (
        !Number.isFinite(opening) ||
        !Number.isFinite(closing) ||
        opening < 0 ||
        closing < opening
    ) {
        throw new Error(
            `${fuelName}: Readings must be valid and closing must not be below opening.`
        );
    }

    if (!Number.isFinite(price) || price <= 0) {
        throw new Error(
            `${fuelName}: Selling price must be greater than zero.`
        );
    }

    const litresSold = closing - opening;
    const sales = litresSold * price;

    if (!Number.isFinite(sales)) {
        throw new Error(`${fuelName}: The sales amount is too large.`);
    }

    return {
        opening,
        closing,
        litresSold,
        price,
        sales
    };
}

/* =========================================
   4. READ THE CURRENT PUMP
   ========================================= */

function hasPumpData() {
    const values = [
        pumpNumberInput.value,
        usePms.checked ? $("#pms-opening").value : "",
        usePms.checked ? $("#pms-closing").value : "",
        useAgo.checked ? $("#ago-opening").value : "",
        useAgo.checked ? $("#ago-closing").value : ""
    ];

    return values.some(value => String(value).trim() !== "");
}

function readCurrentPump() {
    const pumpNo = pumpNumberInput.value.trim();

    if (
        pumpNo === "" ||
        !Number.isSafeInteger(Number(pumpNo)) ||
        Number(pumpNo) <= 0
    ) {
        throw new Error("Enter a valid positive whole pump number.");
    }

    if (!usePms.checked && !useAgo.checked) {
        throw new Error("Select PMS, AGO, or both for this pump.");
    }

    if (pumps.some(pump => pump.pumpNo === pumpNo)) {
        throw new Error(`Pump ${pumpNo} has already been recorded.`);
    }

    const pms = usePms.checked
        ? readFuel(
            "#pms-opening",
            "#pms-closing",
            pmsPriceInput,
            "PMS"
        )
        : null;

    const ago = useAgo.checked
        ? readFuel(
            "#ago-opening",
            "#ago-closing",
            agoPriceInput,
            "AGO"
        )
        : null;

    const pmsSales = pms ? pms.sales : 0;
    const agoSales = ago ? ago.sales : 0;

    return {
        pumpNo,
        pms,
        ago,
        totalLitres:
            (pms ? pms.litresSold : 0) +
            (ago ? ago.litresSold : 0),
        totalSales: pmsSales + agoSales
    };
}

/* =========================================
   5. RESET PUMP ENTRY FIELDS
   ========================================= */

function resetPumpForm() {
    pumpForm.reset();

    usePms.checked = true;
    useAgo.checked = true;

    updateFuelSelection();

    pumpNumberInput.focus();
}

/* =========================================
   6. DISPLAY SAVED PUMPS
   ========================================= */

function renderPumps() {
    pumpList.replaceChildren();

    pumpCount.textContent =
        `${pumps.length} ${pumps.length === 1 ? "pump" : "pumps"}`;

    if (pumps.length === 0) {
        pumpList.appendChild(
            makeElement("p", "No pumps recorded yet.", "empty-state")
        );
        return;
    }

    pumps.forEach((pump, index) => {
        const card = makeElement("article", "", "pump-item");

        const heading = makeElement("div", "", "pump-item-header");

        heading.appendChild(
            makeElement("h4", `Pump ${pump.pumpNo}`)
        );

        const removeButton = makeElement(
            "button",
            "Remove",
            "small-button"
        );

        removeButton.type = "button";
        removeButton.disabled = finished;

        removeButton.addEventListener("click", () => {
            if (finished) return;

            pumps.splice(index, 1);
            renderPumps();

            showMessage(`Pump ${pump.pumpNo} removed.`);
        });

        heading.appendChild(removeButton);
        card.appendChild(heading);

        if (pump.pms) {
            card.appendChild(
                makeElement(
                    "p",
                    `PMS: ${litres(pump.pms.litresSold)} sold`
                )
            );
        }

        if (pump.ago) {
            card.appendChild(
                makeElement(
                    "p",
                    `AGO: ${litres(pump.ago.litresSold)} sold`
                )
            );
        }

        card.appendChild(
            makeElement(
                "p",
                `Total litres: ${litres(pump.totalLitres)}`
            )
        );

        card.appendChild(
            makeElement(
                "p",
                `Pump sales: ${money(pump.totalSales)}`
            )
        );

        pumpList.appendChild(card);
    });
}

/* =========================================
   7. ADD PUMP BUTTON
   ========================================= */

$("#add-pump").addEventListener("click", () => {
    if (finished) return;

    clearMessage();

    try {
        const pump = readCurrentPump();

        pumps.push(pump);

        renderPumps();
        resetPumpForm();

        showMessage(
            `Pump ${pump.pumpNo} saved successfully.`
        );
    } catch (error) {
        showMessage(error.message, "error");
    }
});

/* =========================================
   8. MOVE TO CASH BALANCING
   ========================================= */

$("#next-step").addEventListener("click", () => {
    if (finished) return;

    clearMessage();

    try {
        // Save the current pump only if the user has started entering it.
        if (hasPumpData()) {
            const pump = readCurrentPump();

            pumps.push(pump);
            renderPumps();
            resetPumpForm();
        }

        if (pumps.length === 0) {
            throw new Error("Record at least one pump before continuing.");
        }

        pumpStep.hidden = true;
        cashStep.hidden = false;

        updateDropsTotal();

        cashStep.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    } catch (error) {
        showMessage(error.message, "error");
    }
});

/* =========================================
   9. UPDATE DROP TOTAL
   ========================================= */

function getDropCount() {
    const value = dropsInput.value.trim();

    if (value === "") {
        return 0;
    }

    const count = Number(value);

    if (
        !Number.isSafeInteger(count) ||
        count < 0 ||
        !Number.isFinite(count)
    ) {
        throw new Error("Drops must be a non-negative whole number.");
    }

    if (count > Number.MAX_SAFE_INTEGER / DROP_VALUE) {
        throw new Error("The number of drops is too large.");
    }

    return count;
}

function updateDropsTotal() {
    const count = Number(dropsInput.value);

    if (
        dropsInput.value.trim() === "" ||
        !Number.isSafeInteger(count) ||
        count < 0
    ) {
        dropsTotal.textContent = money(0);
        return;
    }

    dropsTotal.textContent = money(count * DROP_VALUE);
}

dropsInput.addEventListener("input", updateDropsTotal);

/* =========================================
   10. TRANSACTIONS
   ========================================= */

function renderTransactions() {
    transactionList.replaceChildren();

    transactionCount.textContent =
        `${transactions.length} ${
            transactions.length === 1 ? "transaction" : "transactions"
        }`;

    if (transactions.length === 0) {
        transactionList.appendChild(
            makeElement(
                "p",
                "No transactions recorded yet.",
                "empty-state"
            )
        );
    } else {
        transactions.forEach((transaction, index) => {
            const row = makeElement(
                "div",
                "",
                "transaction-item"
            );

            const label = makeElement(
                "span",
                `Transaction ${index + 1}: ${money(transaction.amount)}`
            );

            row.appendChild(label);

            const removeButton = makeElement(
                "button",
                "Remove",
                "small-button"
            );

            removeButton.type = "button";
            removeButton.disabled = finished;

            removeButton.addEventListener("click", () => {
                if (finished) return;

                transactions.splice(index, 1);
                renderTransactions();

                showMessage("Transaction removed.");
            });

            row.appendChild(removeButton);
            transactionList.appendChild(row);
        });
    }

    const total = transactions.reduce(
        (sum, transaction) => sum + transaction.amount,
        0
    );

    transactionTotal.textContent = money(total);
}

function addTransaction() {
    if (finished) return;

    clearMessage();

    const text = transactionInput.value.trim();
    const amount = Number(text);

    if (
        text === "" ||
        !Number.isFinite(amount) ||
        amount <= 0
    ) {
        showMessage(
            "Enter a transaction amount greater than zero.",
            "error"
        );
        return;
    }

    const nextTotal = transactions.reduce(
        (sum, transaction) => sum + transaction.amount,
        0
    ) + amount;

    if (!Number.isFinite(nextTotal)) {
        showMessage("The transaction total is too large.", "error");
        return;
    }

    transactions.push({
        id: transactions.length + 1,
        amount
    });

    transactionInput.value = "";

    renderTransactions();

    showMessage("Transaction added successfully.");
    transactionInput.focus();
}

$("#add-txn").addEventListener("click", addTransaction);

transactionInput.addEventListener("keydown", event => {
    if (event.key === "Enter") {
        event.preventDefault();
        addTransaction();
    }
});

/* =========================================
   11. GO BACK TO PUMPS
   ========================================= */

$("#back-step").addEventListener("click", () => {
    if (finished) return;

    cashStep.hidden = true;
    pumpStep.hidden = false;

    clearMessage();

    pumpStep.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
});

/* =========================================
   12. CALCULATE THE FINAL TOTALS
   ========================================= */

function calculateTotals() {
    const dropCount = getDropCount();

    const totalPmsLitres = pumps.reduce(
        (sum, pump) => sum + (pump.pms?.litresSold || 0),
        0
    );

    const totalAgoLitres = pumps.reduce(
        (sum, pump) => sum + (pump.ago?.litresSold || 0),
        0
    );

    const totalLitres = totalPmsLitres + totalAgoLitres;

    const totalPmsSales = pumps.reduce(
        (sum, pump) => sum + (pump.pms?.sales || 0),
        0
    );

    const totalAgoSales = pumps.reduce(
        (sum, pump) => sum + (pump.ago?.sales || 0),
        0
    );

    const totalSales = totalPmsSales + totalAgoSales;

    const totalDrops = dropCount * DROP_VALUE;

    const totalTransactions = transactions.reduce(
        (sum, transaction) => sum + transaction.amount,
        0
    );

    const cashBalance =
        totalSales - totalDrops - totalTransactions;

    const values = [
        totalPmsLitres,
        totalAgoLitres,
        totalLitres,
        totalPmsSales,
        totalAgoSales,
        totalSales,
        totalDrops,
        totalTransactions,
        cashBalance
    ];

    if (!values.every(Number.isFinite)) {
        throw new Error("A total is outside the supported calculation range.");
    }

    return {
        dropCount,
        totalPmsLitres,
        totalAgoLitres,
        totalLitres,
        totalPmsSales,
        totalAgoSales,
        totalSales,
        totalDrops,
        totalTransactions,
        cashBalance
    };
}

/* =========================================
   13. REPORT TABLE HELPERS
   ========================================= */

function addReportHeading(container, text) {
    container.appendChild(
        makeElement("h3", text, "report-subheading")
    );
}

function addReportRow(container, label, value, extraClass = "") {
    const row = makeElement(
        "div",
        "",
        `summary-row ${extraClass}`.trim()
    );

    row.appendChild(makeElement("span", label));
    row.appendChild(makeElement("strong", value));

    container.appendChild(row);
}

function buildPumpTable() {
    const wrapper = makeElement("div", "", "table-wrapper");
    const table = makeElement("table", "", "report-table");

    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");

    [
        "Pump No.",
        "PMS Litres",
        "AGO Litres",
        "Total Litres",
        "Pump Sales"
    ].forEach(label => {
        const th = makeElement("th", label);

        if (label !== "Pump No.") {
            th.className = "number";
        }

        headerRow.appendChild(th);
    });

    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");

    pumps.forEach(pump => {
        const row = document.createElement("tr");

        const cells = [
            pump.pumpNo,
            pump.pms ? litres(pump.pms.litresSold) : "N/A",
            pump.ago ? litres(pump.ago.litresSold) : "N/A",
            litres(pump.totalLitres),
            money(pump.totalSales)
        ];

        cells.forEach((value, index) => {
            const td = makeElement("td", value);

            if (index > 0) {
                td.className = "number";
            }

            row.appendChild(td);
        });

        tbody.appendChild(row);
    });

    // Add the station total row.
    const totals = calculateTotals();
    const totalRow = document.createElement("tr");

    const totalCells = [
        "TOTAL",
        litres(totals.totalPmsLitres),
        litres(totals.totalAgoLitres),
        litres(totals.totalLitres),
        money(totals.totalSales)
    ];

    totalCells.forEach((value, index) => {
        const td = makeElement("td", value);
        td.style.fontWeight = "800";
        td.style.background = "#f3f6fb";

        if (index > 0) {
            td.className = "number";
        }

        totalRow.appendChild(td);
    });

    tbody.appendChild(totalRow);
    table.appendChild(tbody);
    wrapper.appendChild(table);

    return wrapper;
}

/* =========================================
   14. DISPLAY FINAL REPORT
   ========================================= */

function displayReport(totals) {
    const content = $("#report-content");
    content.replaceChildren();

    addReportHeading(content, "Litres Sold and Sales Per Pump");
    content.appendChild(buildPumpTable());

    addReportHeading(content, "Totals");

    const summary = makeElement("div", "", "summary-list");

    addReportRow(
        summary,
        "Total PMS litres sold",
        litres(totals.totalPmsLitres)
    );

    addReportRow(
        summary,
        "Total AGO litres sold",
        litres(totals.totalAgoLitres)
    );

    addReportRow(
        summary,
        "TOTAL LITRES SOLD",
        litres(totals.totalLitres),
        "total"
    );

    addReportRow(
        summary,
        "Total PMS sales",
        money(totals.totalPmsSales)
    );

    addReportRow(
        summary,
        "Total AGO sales",
        money(totals.totalAgoSales)
    );

    addReportRow(
        summary,
        "TOTAL SALES",
        money(totals.totalSales),
        "total"
    );

    addReportRow(
        summary,
        `Total drops (${totals.dropCount} × ${money(DROP_VALUE)})`,
        money(totals.totalDrops)
    );

    addReportRow(
        summary,
        "TOTAL TRANSACTIONS",
        money(totals.totalTransactions)
    );

    const balanceClass =
        totals.cashBalance < 0 ? "cash-balance negative" : "cash-balance";

    addReportRow(
        summary,
        "FINAL CASH BALANCE",
        money(totals.cashBalance),
        balanceClass
    );

    content.appendChild(summary);

    const note = makeElement(
        "p",
        "Cash balance = Total sales − Total drops − Total transactions. " +
        "A negative balance means drops and transactions exceed recorded sales.",
        "report-note"
    );

    content.appendChild(note);

    $("#report-date").textContent =
        "Generated " + new Date().toLocaleString();
}

/* =========================================
   15. FINISH BALANCING
   ========================================= */

$("#finish").addEventListener("click", () => {
    if (finished) return;

    clearMessage();

    try {
        if (pumps.length === 0) {
            throw new Error("Record at least one pump first.");
        }

        const totals = calculateTotals();

        displayReport(totals);

        finished = true;

        // Freeze the session after generating the report.
        document.querySelectorAll(
            "#pump-form input, #pms-price, #ago-price, " +
            "#drops, #txn, #add-pump, #next-step, " +
            "#add-txn, #back-step, #finish"
        ).forEach(element => {
            element.disabled = true;
        });

        renderPumps();
        renderTransactions();

        cashStep.hidden = true;
        pumpStep.hidden = true;
        reportStep.hidden = false;

        reportStep.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    } catch (error) {
        showMessage(error.message, "error");
    }
});

/* =========================================
   16. PRINT REPORT
   ========================================= */

$("#print-report").addEventListener("click", () => {
    window.print();
});

/* =========================================
   17. START A NEW SESSION
   ========================================= */

$("#new-session").addEventListener("click", () => {
    const confirmed = window.confirm(
        "Start a new balancing session? The current unsaved report will be cleared."
    );

    if (!confirmed) return;

    pumps = [];
    transactions = [];
    finished = false;

    pumpForm.reset();

    pmsPriceInput.value = "";
    agoPriceInput.value = "";
    dropsInput.value = "";
    transactionInput.value = "";

    usePms.checked = true;
    useAgo.checked = true;

    document.querySelectorAll(
        "#pump-form input, #pms-price, #ago-price, " +
        "#drops, #txn, #add-pump, #next-step, " +
        "#add-txn, #back-step, #finish"
    ).forEach(element => {
        element.disabled = false;
    });

    updateFuelSelection();
    renderPumps();
    renderTransactions();
    updateDropsTotal();
    clearMessage();

    $("#report-content").replaceChildren();

    reportStep.hidden = true;
    cashStep.hidden = true;
    pumpStep.hidden = false;

    pumpStep.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
});

/* =========================================
   18. INITIAL DISPLAY
   ========================================= */

renderPumps();
renderTransactions();
updateDropsTotal();
