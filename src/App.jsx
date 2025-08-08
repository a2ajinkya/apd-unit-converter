import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import unitData from './assets/unit_conversion_data_updated.json';

function App() {
  const [selectedCategory, setSelectedCategory] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [detectedUnit, setDetectedUnit] = useState('');
  const [detectedValue, setDetectedValue] = useState('');
  const [targetUnit, setTargetUnit] = useState('');
  const [conversions, setConversions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  const dropdownRef = useRef(null);

  const categories = unitData ? Object.keys(unitData) : [];

  // Reset input when category changes
  useEffect(() => {
    setInputValue('');
    setDetectedUnit('');
    setDetectedValue('');
    setTargetUnit('');
    setConversions([]);
  }, [selectedCategory]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dropdownRef]);

  const parseInput = (input) => {
    if (!selectedCategory || !input.trim()) return null;

    const categoryUnits = unitData[selectedCategory]?.units || {};
    
    // Check for "to" pattern first
    const toMatch = input.match(/^(.+?)\s+to\s+(.+)$/i);
    if (toMatch) {
      const [, fromPart, toPart] = toMatch;
      const fromResult = parseValueAndUnit(fromPart, categoryUnits);
      const toResult = parseUnit(toPart, categoryUnits);
      
      if (fromResult && toResult) {
        return {
          value: fromResult.value,
          unit: fromResult.unit,
          targetUnit: toResult.unit
        };
      }
    }

    // Parse just value and unit
    const result = parseValueAndUnit(input, categoryUnits);
    return result ? { ...result, targetUnit: null } : null;
  };

  const parseValueAndUnit = (input, categoryUnits) => {
    const trimmed = input.trim();
    
    // Try to match number followed by unit
    const match = trimmed.match(/^([\d.,]+)\s*(.*)$/);
    if (!match) return null;
    
    const [, valueStr, unitStr] = match;
    const value = parseFloat(valueStr.replace(/,/g, ''));
    if (isNaN(value)) return null;
    
    const unit = findBestUnitMatch(unitStr.trim(), categoryUnits);
    return unit ? { value, unit } : null;
  };

  const parseUnit = (unitStr, categoryUnits) => {
    const unit = findBestUnitMatch(unitStr.trim(), categoryUnits);
    return unit ? { unit } : null;
  };

  const findBestUnitMatch = (unitStr, categoryUnits) => {
    if (!unitStr) return null;
    
    const unitKeys = Object.keys(categoryUnits);
    const unitNames = unitKeys.map(key => categoryUnits[key].name);
    
    // Exact key match (highest priority)
    const exactKeyMatch = unitKeys.find(key => key.toLowerCase() === unitStr.toLowerCase());
    if (exactKeyMatch) return exactKeyMatch;
    
    // Exact name match
    const exactNameMatch = unitKeys.find(key => 
      categoryUnits[key].name.toLowerCase() === unitStr.toLowerCase()
    );
    if (exactNameMatch) return exactNameMatch;
    
    // Partial key match
    const partialKeyMatch = unitKeys.find(key => 
      key.toLowerCase().includes(unitStr.toLowerCase()) || 
      unitStr.toLowerCase().includes(key.toLowerCase())
    );
    if (partialKeyMatch) return partialKeyMatch;
    
    // Partial name match
    const partialNameMatch = unitKeys.find(key => 
      categoryUnits[key].name.toLowerCase().includes(unitStr.toLowerCase()) ||
      unitStr.toLowerCase().includes(categoryUnits[key].name.toLowerCase())
    );
    if (partialNameMatch) return partialNameMatch;
    
    return null;
  };

  const convertUnits = (value, fromUnit, toUnit, category) => {
    const categoryData = unitData[category];
    if (!categoryData) return null;

    const fromUnitData = categoryData.units[fromUnit];
    const toUnitData = categoryData.units[toUnit];
    
    if (!fromUnitData || !toUnitData) return null;

    // Special handling for temperature
    if (category === 'temperature') {
      return convertTemperature(value, fromUnit, toUnit);
    }

    // Convert to base unit first, then to target unit
    const baseValue = value * fromUnitData.factor;
    const convertedValue = baseValue / toUnitData.factor;
    
    return convertedValue;
  };

  const convertTemperature = (value, fromUnit, toUnit) => {
    // Convert to Celsius first
    let celsius;
    switch (fromUnit) {
      case 'c': celsius = value; break;
      case 'f': celsius = (value - 32) * 5/9; break;
      case 'k': celsius = value - 273.15; break;
      case 'r': celsius = (value - 491.67) * 5/9; break;
      default: return null;
    }
    
    // Convert from Celsius to target
    switch (toUnit) {
      case 'c': return celsius;
      case 'f': return celsius * 9/5 + 32;
      case 'k': return celsius + 273.15;
      case 'r': return celsius * 9/5 + 491.67;
      default: return null;
    }
  };

  const formatNumber = (num) => {
    if (Math.abs(num) >= 1e6 || (Math.abs(num) < 0.001 && num !== 0)) {
      return num.toExponential(6);
    }
    return parseFloat(num.toFixed(6)).toString();
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    setInputValue(value);
    
    if (!selectedCategory || !value.trim()) {
      setDetectedUnit('');
      setDetectedValue('');
      setTargetUnit('');
      setConversions([]);
      return;
    }

    const parsed = parseInput(value);
    if (parsed) {
      setDetectedValue(parsed.value);
      setDetectedUnit(parsed.unit);
      setTargetUnit(parsed.targetUnit || '');
      
      const categoryUnits = unitData[selectedCategory].units;
      const newConversions = [];
      
      Object.keys(categoryUnits).forEach(unitKey => {
        if (unitKey !== parsed.unit) {
          const converted = convertUnits(parsed.value, parsed.unit, unitKey, selectedCategory);
          if (converted !== null) {
            newConversions.push({
              unit: unitKey,
              name: categoryUnits[unitKey].name,
              value: converted
            });
          }
        }
      });
      
      setConversions(newConversions);
    } else {
      setDetectedUnit('');
      setDetectedValue('');
      setTargetUnit('');
      setConversions([]);
    }
  };

  const handleCategorySelect = (category) => {
    setSelectedCategory(category);
    setShowDropdown(false);
  };

  const getDisplayedConversions = () => {
    if (targetUnit) {
      return conversions.filter(conv => conv.unit === targetUnit);
    }
    return conversions;
  };

  const renderTooltipPanel = () => {
    if (!showTooltip) return null;

    return (
      <div className="tooltip-panel">
        <div className="tooltip-header">
          <h3>Available Units by Category</h3>
          <button 
            className="close-btn"
            onClick={() => setShowTooltip(false)}
          >
            ×
          </button>
        </div>
        <div className="tooltip-content">
          {categories.map(category => (
            <div key={category} className="category-section">
              <h4>{category.charAt(0).toUpperCase() + category.slice(1)}</h4>
              <div className="units-grid">
                {Object.entries(unitData[category].units).map(([key, unit]) => (
                  <div key={key} className="unit-item">
                    <span className="unit-key">{key}</span>
                    <span className="unit-name">{unit.name}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="app">
      <div className="window">
        <div className="title-bar">
          <div className="title-bar-controls">
            <div className="control close"></div>
            <div className="control minimize"></div>
            <div className="control maximize"></div>
          </div>
          <div className="title-text">APD Unit Converter</div>
          <div className="help-btn" onClick={() => setShowTooltip(true)}>?</div>
        </div>
        
        <div className="window-content">
          <div className="header">
            <div className="icon">🧮</div>
            <h1>APD Unit Converter</h1>
            <p>Powerful unit conversion calculator based on engineering mathematical data</p>
          </div>

          <div className="converter-section">
            <div className="section-title">Select Unit Category</div>
            <p className="section-subtitle">Choose the type of units you want to convert</p>
            
            <div className="dropdown-container" ref={dropdownRef}>
              <button 
                className={`dropdown-btn ${selectedCategory ? 'selected' : ''}`}
                onClick={() => setShowDropdown(!showDropdown)}
              >
                {selectedCategory ? selectedCategory.charAt(0).toUpperCase() + selectedCategory.slice(1) : 'Select a unit category...'}
                <span className="dropdown-arrow">▼</span>
              </button>
              
              {showDropdown && (
                <div className="dropdown-menu">
                  {categories.map(category => (
                    <div 
                      key={category}
                      className="dropdown-item"
                      onClick={() => handleCategorySelect(category)}
                    >
                      {category.charAt(0).toUpperCase() + category.slice(1)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {selectedCategory && (
            <div className="converter-section">
              <div className="section-title">Unit Conversion</div>
              <p className="section-subtitle">
                Type your value with unit (e.g., "400 km") or specify target unit (e.g., "400 km to m")
              </p>
              
              <input
                type="text"
                className="input-field"
                placeholder={`Enter value with unit (e.g., "100 ${Object.keys(unitData[selectedCategory].units)[0]}")`}
                value={inputValue}
                onChange={handleInputChange}
              />
              
              {detectedUnit && (
                <div className="detection-info">
                  Detected: {detectedValue} {unitData[selectedCategory].units[detectedUnit]?.name}
                  {targetUnit && (
                    <>
                      <span className="arrow"> → </span>
                      Target: {unitData[selectedCategory].units[targetUnit]?.name}
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {conversions.length > 0 && (
            <div className="results-section">
              <div className="results-header">
                <div className="section-title">Conversion Results</div>
                <p className="section-subtitle">
                  {targetUnit ? 'Specific conversion result' : 'All available conversions'}
                </p>
                {!targetUnit && conversions.length > 3 && (
                  <button className="collapse-btn">
                    ▲ Collapse
                  </button>
                )}
              </div>
              
              <div className="conversions-list">
                {getDisplayedConversions().map(conversion => (
                  <div key={conversion.unit} className="conversion-item">
                    <div className="unit-info">
                      <span className="unit-symbol">{conversion.unit}</span>
                      <span className="unit-name">{conversion.name}</span>
                    </div>
                    <div className="conversion-value">
                      <span className="value">{formatNumber(conversion.value)}</span>
                      <span className="unit">{conversion.unit}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="footer">
            <p>Based on mathematical data from P.W.D. Handbook Chapter 38</p>
            <p>Supports {categories.length} categories with comprehensive unit conversions</p>
          </div>
        </div>
      </div>
      
      {renderTooltipPanel()}
    </div>
  );
}

export default App;


