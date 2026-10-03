.pragma library

var _data = {
    "en": {
        "applyAllParts": "Apply to all parts",
        "basicFormat": "Basic format:",
        "cleanFingering": "Clean fingering",
        "cleanTextBoxes": "Clean text boxes",
        "setStyle": "Set style",
        "adjustScale": "Adjust Scale",
        "leadingSpace": "Leading space",
        "addFingering": "Add fingering",
        "fingeringSize": "Fingering size",
        "manualAdjust": "Manual adjust:",
        "fingeringSizeLabel": "Fingering size:",
        "spatium": "Spatium:",
        "options": "Options:",
        "oneCharFingering": "Use one char fingering",
        "debugMode": "Debug log"
    },
    "pt-br": {
        "applyAllParts": "Aplicar em todas as partes",
        "basicFormat": "Formatação básica:",
        "cleanFingering": "Limpar piratas",
        "cleanTextBoxes": "Limpar caixas de texto",
        "setStyle": "Estilo de página de caderninho",
        "adjustScale": "Ajustar escala",
        "leadingSpace": "Espaço inicial",
        "addFingering": "Adicionar piratas",
        "fingeringSize": "Tamanho dos piratas",
        "manualAdjust": "Ajuste manual:",
        "fingeringSizeLabel": "Tamanho dos piratas:",
        "spatium": "Espaçamento:",
        "options": "Opções:",
        "oneCharFingering": "Pirata de número de posição",
        "debugMode": "Mostrar logs"
    }
};

function t(locale, key) {
    return (_data[locale] && _data[locale][key]) || _data["en"][key] || key;
}
