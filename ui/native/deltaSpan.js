function setOperationForPrimitiveSpanContent(target) {
    if (isPrimitiveSpanContent(target)) {
        var contentType = target.className;
        var content = target.textContent;

        var spanContentElm = document.createElement("li");
        var subMenu = document.createElement("ul");
        spanContentElm.classList.add("primitive-span-content");
        spanContentElm.textContent =  "Content: " + contentType + " type";
        subMenu.classList.add("sub-menu");

        if (contentType === "int") {
            setOperationForIntSpanContent(target, content, subMenu);
        } else if (contentType === "str") {
            setOperationForStrSpanContent(target, content, subMenu);
        }

        spanContentElm.appendChild(subMenu);
        editMenu.appendChild(spanContentElm);
    }
}

function setOperationForIntSpanContent(target, content, subMenu) {
    var controls = document.createElement("li");
    var intRange = document.createElement("input");
    var intNumber = document.createElement("input");
    var oldValue = parseInt(content, 10);
    var draftValue = oldValue;

    controls.className = "integer-editor";
    intRange.type = "range";
    intRange.step = "1";
    intRange.setAttribute("aria-label", "Adjust integer value");
    intNumber.type = "number";
    intNumber.step = "1";
    intNumber.setAttribute("aria-label", "Integer value");
    intNumber.value = oldValue;

    function setRange(value) {
        var radius = Math.max(10, Math.pow(10,
            Math.floor(Math.log10(Math.max(1, Math.abs(value))))));
        intRange.min = Math.max(Number.MIN_SAFE_INTEGER, value - radius);
        intRange.max = Math.min(Number.MAX_SAFE_INTEGER, value + radius);
        intRange.value = value;
    }

    function isValidValue(value) {
        return Number.isSafeInteger(value) && Number.isSafeInteger(value - oldValue);
    }

    function commit() {
        var value = draftValue;
        if (!isValidValue(value)) value = oldValue;

        // Recenter only after confirming a value outside the current range.
        if (value < Number(intRange.min) || value > Number(intRange.max)) {
            setRange(value);
        } else {
            intRange.value = value;
        }
        intNumber.value = value;
        target.textContent = value.toString();
        draftValue = value;

        var diff = value - oldValue;
        if (diff !== 0) {
            genPrimitiveSpanDelta(target, `(+${diff})`);
            oldValue = value;
        }
    }

    setRange(oldValue);
    intRange.addEventListener("input", function() {
        draftValue = intRange.valueAsNumber;
        intNumber.value = intRange.value;
        target.textContent = intRange.value;
    });
    intNumber.addEventListener("input", function() {
        var value = intNumber.valueAsNumber;
        draftValue = value;
        if (isValidValue(value)) {
            target.textContent = value.toString();
            if (value >= Number(intRange.min) && value <= Number(intRange.max)) {
                intRange.value = value;
            }
        }
    });

    // Share the draft too: leaving either control must commit the latest edit.
    ["change", "mouseleave", "blur"].forEach(function(eventName) {
        intRange.addEventListener(eventName, commit);
        intNumber.addEventListener(eventName, commit);
    });
    intNumber.addEventListener("keydown", function(event) {
        if (event.key === "Enter") {
            event.preventDefault();
            commit();
        }
    });

    controls.appendChild(intRange);
    controls.appendChild(intNumber);
    subMenu.appendChild(controls);
}

function setOperationForStrSpanContent(target, content, subMenu) {
    // 1. create element in sub menu
    var strInput = document.createElement("input");

    // 2. init element in sub menu
    strInput.value = content;
    strInput.setAttribute("oldValue", strInput.value);

    // 3. bind event handler for input & mouseleave
    strInput.addEventListener("input", function(localStrInput) {
        return function() {
            var newValue = localStrInput.value;
            target.textContent = newValue;
        }
    }(strInput));
    strInput.addEventListener("mouseleave", function(localStrInput) {
        return function() {
            var oldValue = localStrInput.getAttribute("oldValue");
            var newValue = localStrInput.value;

            var d;
            if (oldValue === newValue) d = idDelta;
            else d = `("${oldValue}"=>"${newValue}")`;
            genPrimitiveSpanDelta(target, d);

            localStrInput.setAttribute("oldValue", localStrInput.value);
        }
    }(strInput));

    // 4. append it to sub menu
    subMenu.appendChild(strInput);
}

function genPrimitiveSpanDelta(element, d) {
    propagateDelta(element, d);
}
