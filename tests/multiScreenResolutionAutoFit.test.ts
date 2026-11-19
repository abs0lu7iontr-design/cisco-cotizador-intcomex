import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

describe('Global Multi-Screen Resolution & Auto-Fit Optimization', () => {
  it('1. useTableDensityAndZoom hook file exists and defines Auto-Fit, Compact & Normal modes', () => {
    const hookPath = path.resolve('src/hooks/useTableDensityAndZoom.ts');
    assert.ok(fs.existsSync(hookPath), 'useTableDensityAndZoom.ts must exist');

    const content = fs.readFileSync(hookPath, 'utf8');
    assert.ok(content.includes("'auto' | 'compact' | 'normal'"), 'Must define 3 density modes: auto, compact, normal');
    assert.ok(content.includes('Math.max(75, Math.min(115'), 'Must clamp zoom between 75% and 115%');
    assert.ok(content.includes('headPaddingClass'), 'Must return headPaddingClass');
    assert.ok(content.includes('cellPaddingClass'), 'Must return cellPaddingClass');
    assert.ok(content.includes('zoomStyle'), 'Must return zoomStyle');
  });

  it('2. TableDensityZoomControls UI component exists with responsive buttons and zoom triggers', () => {
    const componentPath = path.resolve('src/components/TableDensityZoomControls.tsx');
    assert.ok(fs.existsSync(componentPath), 'TableDensityZoomControls.tsx must exist');

    const content = fs.readFileSync(componentPath, 'utf8');
    assert.ok(content.includes('Auto-Fit'), 'Must render Auto-Fit button');
    assert.ok(content.includes('Compacto'), 'Must render Compacto button');
    assert.ok(content.includes('Estándar'), 'Must render Estándar button');
    assert.ok(content.includes('ZoomIn'), 'Must render ZoomIn icon/button');
    assert.ok(content.includes('ZoomOut'), 'Must render ZoomOut icon/button');
  });

  it('3. ForecastView incorporates useTableDensityAndZoom, TableDensityZoomControls and zoomStyle', () => {
    const forecastPath = path.resolve('src/modules/forecast/ForecastView.tsx');
    const content = fs.readFileSync(forecastPath, 'utf8');

    assert.ok(content.includes('useTableDensityAndZoom'), 'ForecastView must import and call useTableDensityAndZoom');
    assert.ok(content.includes('TableDensityZoomControls'), 'ForecastView must render TableDensityZoomControls');
    assert.ok(content.includes('style={zoomStyle}'), 'ForecastView table container must apply zoomStyle');
    assert.ok(content.includes('headPaddingClass'), 'ForecastView headers must use headPaddingClass');
    assert.ok(content.includes('cellPaddingClass'), 'ForecastView cells must use cellPaddingClass');
    assert.ok(content.includes('grid-cols-2 sm:grid-cols-3 xl:grid-cols-6'), 'KPI cards must use responsive auto-fit grid');
  });

  it('4. PipelineView incorporates useTableDensityAndZoom, TableDensityZoomControls and zoomStyle', () => {
    const pipelinePath = path.resolve('src/modules/pipeline/PipelineView.tsx');
    const content = fs.readFileSync(pipelinePath, 'utf8');

    assert.ok(content.includes('useTableDensityAndZoom'), 'PipelineView must import and call useTableDensityAndZoom');
    assert.ok(content.includes('TableDensityZoomControls'), 'PipelineView must render TableDensityZoomControls');
    assert.ok(content.includes('style={zoomStyle}'), 'PipelineView table and kanban containers must apply zoomStyle');
    assert.ok(content.includes('headPaddingClass'), 'PipelineView headers must use headPaddingClass');
    assert.ok(content.includes('cellPaddingClass'), 'PipelineView cells must use cellPaddingClass');
    assert.ok(content.includes('min-w-0'), 'PipelineView filter bar must use min-w-0 for fluid wrapping');
  });

  it('5. BoTrackingView incorporates useTableDensityAndZoom, TableDensityZoomControls and zoomStyle', () => {
    const boPath = path.resolve('src/modules/bo/BoTrackingView.tsx');
    const content = fs.readFileSync(boPath, 'utf8');

    assert.ok(content.includes('useTableDensityAndZoom'), 'BoTrackingView must import and call useTableDensityAndZoom');
    assert.ok(content.includes('TableDensityZoomControls'), 'BoTrackingView must render TableDensityZoomControls');
    assert.ok(content.includes('style={zoomStyle}'), 'BoTrackingView table and kanban containers must apply zoomStyle');
    assert.ok(content.includes('headPaddingClass'), 'BoTrackingView headers must use headPaddingClass');
    assert.ok(content.includes('cellPaddingClass'), 'BoTrackingView cells must use cellPaddingClass');
  });

  it('6. InteractiveTable (CCW Quoter) incorporates useTableDensityAndZoom, TableDensityZoomControls and cellPaddingClass', () => {
    const quoterPath = path.resolve('src/components/InteractiveTable.tsx');
    const content = fs.readFileSync(quoterPath, 'utf8');

    assert.ok(content.includes('useTableDensityAndZoom'), 'InteractiveTable must import and call useTableDensityAndZoom');
    assert.ok(content.includes('TableDensityZoomControls'), 'InteractiveTable must render TableDensityZoomControls');
    assert.ok(content.includes('zoomStyle'), 'InteractiveTable must apply zoomStyle to scroll container');
    assert.ok(content.includes('headPaddingClass'), 'InteractiveTable headers must use headPaddingClass');
    assert.ok(content.includes('cellPaddingClass'), 'InteractiveTable cells must use cellPaddingClass');
  });

  it('7. SummaryCards incorporates responsive fluid typography and adaptive grid', () => {
    const summaryPath = path.resolve('src/components/SummaryCards.tsx');
    const content = fs.readFileSync(summaryPath, 'utf8');

    assert.ok(content.includes('grid-cols-1 sm:grid-cols-2 xl:grid-cols-4'), 'SummaryCards must use responsive 4-column grid');
    assert.ok(content.includes('text-lg sm:text-xl xl:text-2xl'), 'SummaryCards must use fluid typography for currency amounts');
  });

  it('8. CcwrQuoteView incorporates useTableDensityAndZoom, TableDensityZoomControls and zoomStyle', () => {
    const ccwrPath = path.resolve('src/modules/ccwrQuote/CcwrQuoteView.tsx');
    const content = fs.readFileSync(ccwrPath, 'utf8');

    assert.ok(content.includes('useTableDensityAndZoom'), 'CcwrQuoteView must import and call useTableDensityAndZoom');
    assert.ok(content.includes('TableDensityZoomControls'), 'CcwrQuoteView must render TableDensityZoomControls');
    assert.ok(content.includes('style={zoomStyle}'), 'CcwrQuoteView table must apply zoomStyle');
    assert.ok(content.includes('headPaddingClass'), 'CcwrQuoteView headers must use headPaddingClass');
    assert.ok(content.includes('cellPaddingClass'), 'CcwrQuoteView cells must use cellPaddingClass');
  });

  it('9. DemandIntelligenceView incorporates useTableDensityAndZoom, TableDensityZoomControls and zoomStyle', () => {
    const demandPath = path.resolve('src/modules/demandIntelligence/DemandIntelligenceView.tsx');
    const content = fs.readFileSync(demandPath, 'utf8');

    assert.ok(content.includes('useTableDensityAndZoom'), 'DemandIntelligenceView must import and call useTableDensityAndZoom');
    assert.ok(content.includes('TableDensityZoomControls'), 'DemandIntelligenceView must render TableDensityZoomControls');
    assert.ok(content.includes('style={zoomStyle}'), 'DemandIntelligenceView table must apply zoomStyle');
    assert.ok(content.includes('headPaddingClass'), 'DemandIntelligenceView headers must use headPaddingClass');
    assert.ok(content.includes('cellPaddingClass'), 'DemandIntelligenceView cells must use cellPaddingClass');
  });

  it('10. DsvView incorporates useTableDensityAndZoom, TableDensityZoomControls and zoomStyle', () => {
    const dsvPath = path.resolve('src/modules/dsv/DsvView.tsx');
    const content = fs.readFileSync(dsvPath, 'utf8');

    assert.ok(content.includes('useTableDensityAndZoom'), 'DsvView must import and call useTableDensityAndZoom');
    assert.ok(content.includes('TableDensityZoomControls'), 'DsvView must render TableDensityZoomControls');
    assert.ok(content.includes('style={zoomStyle}'), 'DsvView preview table must apply zoomStyle');
    assert.ok(content.includes('headPaddingClass'), 'DsvView headers must use headPaddingClass');
    assert.ok(content.includes('cellPaddingClass'), 'DsvView cells must use cellPaddingClass');
  });

  it('11. App.tsx main container has min-w-0 and overflow-x-hidden preventing layout blowout', () => {
    const appPath = path.resolve('src/App.tsx');
    const content = fs.readFileSync(appPath, 'utf8');

    assert.ok(
      content.includes('main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden'),
      'App.tsx <main> must prevent outer horizontal overflow with min-w-0 and overflow-x-hidden'
    );
  });
});
