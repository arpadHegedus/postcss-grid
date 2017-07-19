/**
 * POSTCSS GRIDDER
 * A PostCSS plugin to add dynamic grid layouts with a choice of using flexbox, float or inline-block elements
 * @version 1.0.0
 * @author Arpad Hegedus <hegedus.arpad@gmail.com>
 */

let postcss = require('postcss'),
    util = require('postcss-plugin-utilities');

module.exports = postcss.plugin('postcss-gridder', (opt = {}) => { 
    let getSibling = (prop, decl) => { 
        let r = null;
        decl.parent.walkDecls(prop, d => {
            r = d.value;
        });
        return r;
    }
    return css => { 
        opt = Object.assign({
            columns: 12,
            mode: 'flex'
        }, opt);

        css.walkDecls('grid', decl => {
            let parent = decl.parent,
                settings = util.filterObject((decl.value.indexOf(',') === -1)? postcss.list.space(decl.value) : postcss.list.comma(decl.value), {
                    span: [(v) => { return util.isRegex(v, /[0-9\.]+(\s?(\/|of)\s?[0-9\.]+)?/ig); }, util.isSize, 'auto'],
                    align: ['left', 'right', 'center'],
                    gutter: [util.isSize],
                    reset: ['first', 'last', util.isNumber, 'auto', 'none', 'no-reset'],
                    mode: ['flex', 'float', 'inline', 'inline-block'],
                    bleed: ['bleed', 'no-bleed']
                }, { span: 'auto', align: 'left', mode: (opt.mode)? opt.mode : 'float' }),
                parentSelector = null;
            postcss.list.comma(parent.selector).forEach(selector => { 
                selector = selector.split('>').slice(0, -1).join('>');
                if (selector !== '') { parentSelector = (parentSelector) ? `${parentSelector}, ${selector}` : selector; }
            });
            if (parentSelector) { 
                let decls = '';
                if (settings.mode === 'flex') {
                    decls = 'display: flex; flex-direction: row; width: 100%; flex-wrap: wrap;';
                } else if (settings.mode === 'inline' || settings.mode === 'inline-block') {
                    decls = `text-align: ${settings.align}`;
                } else if (settings.mode === 'float') { 
                    let selectorBefore = util.eachSelector(parentSelector, '&:after');
                    parent.before(postcss.parse(`${selectorBefore} { content: " "; display: table; clear: both }`));
                    decls = 'display: block;';
                }
                if (decls !== '') { parent.before(postcss.parse(`${parentSelector} { ${decls} }`)); }
            }
            delete settings.mode;
            if (settings.gutter && !settings.reset) { settings.reset = 'auto'; }
            if (settings) {
                for (let [prop, val] of Object.entries(settings)) {
                    decl.before({ prop: prop, value: val });
                }
            }
            decl.remove();
        });

        css.walkDecls('span', decl => {
            let span = decl.value.replace(/of/ig, '/').replace(/[\s]+/ig, ''),
                columns = (opt.columns) ? opt.columns : 12;
            if (util.isRegex(span, /[0-9\.]+(\/[0-9\.]+)?/ig)) {
                span = span.split('/');
                if (span.length > 1) { columns = span[1]; }
                span = span[0];
                span = util.calc('x/y*100', { x: span, y: columns }) + '%';
            }
            decl.after({ prop: 'width', value: span });
        });

        css.walkDecls('reset', decl => {
            let parent = decl.parent,
                reset = decl.value;
            if (reset === 'no-reset' || reset === 'none' || reset === '0') { reset = null; }
            if (reset === 'auto') {
                reset = null;
                let width = getSibling('width', decl);
                if (width && width.indexOf('%') >= 0) {
                    var span = parseFloat(util.calc('100/x', width.replace(/[^0-9\.]/ig, ''))),
                        r = Math.round(span),
                        precision = Math.round(span * 100) / 100;
                    if (precision - r === 0) { 
                        reset = r;
                    }
                }
            }
            if (reset) {
                let selector = '';
                if (reset === 'first' || reset === '1' || reset === 1) { selector = '&:first-child'; decl.value = 1; }
                else if (reset === 'last') { selector = '&:last-child'; }
                else { selector = `&:nth-child(${reset}n+1)`; decl.value = reset; }
                selector = util.eachSelector(parent.selector, selector);
                selector += ' { margin-right: 0; margin-left: 0; }';
                parent.before(postcss.parse(selector));
            } else { decl.remove(); }
        });

        css.walkDecls('gutter', decl => {
            let parent = decl.parent,
                gutter = decl.value,    
                margin = getSibling('align', decl),
                marginOther = 'right',
                marginBoth = false,
                bleed = getSibling('bleed', decl),
                reset = getSibling('reset', decl),
                width = null,
                widthDecl = null;
            parent.walkDecls('width', decl => {
                width = decl.value;
                widthDecl = decl;
            });
            bleed = (bleed && (bleed === 'true' || bleed === 'bleed')) ? true : false;
            if (margin && (margin === 'left' || margin === 'right')) {
                marginOther = (margin === 'left') ? 'right' : 'left';
                marginBoth = null;
            } else if (margin && (margin === 'center')) {
                margin: null;
                marginOther = null;
                marginBoth = true;
            } else { 
                margin = null;
                marginOther = null;
                marginBoth = null;
            }
            if (util.isSize(gutter)) { 
                let styles = {
                    'margin-left': null,
                    'margin-right': null
                }
                if (marginOther) {
                    styles['margin-' + margin] = gutter;
                    styles['margin-' + marginOther] = '0';
                } else { 
                    styles['margin-right'] = util.calc('x/2', gutter);
                    styles['margin-left'] = util.calc('x/2', gutter);
                }
                if (bleed) {
                    styles['margin-right'] = util.calc('x/2', styles['margin-right']);
                    styles['margin-left'] = util.calc('x/2', styles['margin-left']);
                    styles['padding-right'] = styles['margin-right'];
                    styles['padding-left'] = styles['margin-left'];
                    if (reset) { 
                        let resetSelector = util.eachSelector(parent.selector, `&:nth-child(${reset}n+1)`);
                        if (reset === 1) { resetSelector = util.eachSelector(parent.selector, `&:first-child`); }
                        if (reset === 'last') { resetSelector = util.eachSelector(parent.selector, `&:last-child`); }
                        parent.parent.walkRules(resetSelector, rule => { rule.append(' padding-right: 0; padding-left: 0;'); });
                    }
                }
                for (let [prop, val] of Object.entries(styles)) { decl.before({ prop: prop, value: val }); }
                if (reset && width && width !== 'auto') { 
                    let unit = null,
                        baseWidth = util.calc('x/100', width),
                        baseGutter = gutter.replace(/[^0-9\.\-]/ig, ''),
                        calcWidth = (marginOther) ? `calc(99.9999999999999999% * ${baseWidth} - (${gutter} - ${gutter} * ${baseWidth}))` : `calc(99.9999999999999999% * ${baseWidth} - ${gutter})`,
                        percWidth = (marginOther) ? util.calc('99.9999999999999999 * x - (y - y * x)', { x: baseWidth, y: baseGutter }) : util.calc('99.9999999999999999 * (x - y/100)', { x: baseWidth, y: baseGutter });
                    if (width.indexOf('%') > 0 && gutter.indexOf('%') > 0) { unit = '%'; }
                    if (unit) {
                        widthDecl.value = percWidth;
                    } else {
                        widthDecl.value = calcWidth;
                    }
                }
            }
        });
        css.walkDecls('span', decl => { decl.remove(); });
        css.walkDecls('gutter', decl => { decl.remove(); });
        css.walkDecls('align', decl => { decl.remove(); });
        css.walkDecls('reset', decl => { decl.remove(); });
        css.walkDecls('bleed', decl => { decl.remove(); });
    }
});