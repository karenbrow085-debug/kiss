/* Shared 404 status viewer; offline passes its own panel without swapping character data. */
window.openCharacterStatusPanel = function(char, overridePanel, viewerOptions={}) {
 const panelData=overridePanel||char?.statusPanel;if(!char||!panelData)return;
 const statusContent=document.getElementById('char-status-content'),statusOverlay=document.getElementById('char-status-overlay');if(!statusContent||!statusOverlay)return;
 const offline=!!overridePanel,options={panel:panelData,offline,...viewerOptions};
 statusOverlay.dataset.offline=String(offline);statusOverlay.dataset.readonly=String(!!options.readOnly);
 // Portal out of the hidden phone-chat screen; reuse existing styling and handlers.
 const parent=document.querySelector('.phone-screen')||document.getElementById('chat-room-screen')?.parentNode||document.body;
 if(statusOverlay.parentNode!==parent)parent.append(statusOverlay);
 statusOverlay.style.paddingTop='max(20px, env(safe-area-inset-top, 0px))';
            statusContent.innerHTML = ''; // Clear previous content

            // Prepare data: combine history and current if needed
            let slidesData = [];
            if (panelData.history && panelData.history.length > 0) {
                // history is [newest, older, oldest...]
                // We want to display newest last (on the right), so history is on the left
                slidesData = [...panelData.history].reverse();
            } else if (panelData.currentStatusHtml) {
                slidesData = [{ html: panelData.currentStatusHtml, timestamp: Date.now() }];
            }

            if (slidesData.length === 0) {
                statusContent.innerHTML = '<p style="text-align:center; color:#999;">暂无状态信息</p>';
                if(!options.readOnly)window.attachStatusHistoryControls?.(char, statusContent, slidesData, null, null, options);
                statusOverlay.classList.add('visible');
                return;
            }

            // Build Swiper Structure
            const swiper = document.createElement('div');
            swiper.className = 'status-swiper';

            // Helper function for Lazy Loading
            const loadSlideContent = (index) => {
                if (index < 0 || index >= slidesData.length) return;
                const slide = swiper.children[index];
                if (!slide) return;
                const slideInner = slide.querySelector('.status-slide-inner');
                if (slideInner.hasChildNodes()) return; // Already loaded

                const item = slidesData[index];
                const htmlContent = item.html;
                if (htmlContent.includes('<!DOCTYPE html>') || htmlContent.includes('<html') || htmlContent.includes('<style')) {
                    const iframe = document.createElement('iframe');
                    iframe.style.cssText = "width: 100%; height: 100%; min-height: 80vh; border: none; background: transparent; display: block;";
                    iframe.srcdoc = processTemplate(htmlContent, char);
                    slideInner.appendChild(iframe);
                } else {
                    slideInner.innerHTML = processTemplate(htmlContent, char);
                }
            };

            // Create empty slides first
            slidesData.forEach((item, index) => {
                const slide = document.createElement('div');
                slide.className = 'status-slide';
                
                const slideInner = document.createElement('div');
                slideInner.className = 'status-slide-inner';
                // Content will be loaded lazily
                
                slide.appendChild(slideInner);
                swiper.appendChild(slide);
            });

            // Indicator
            const indicator = document.createElement('div');
            indicator.className = 'status-indicator';
            indicator.textContent = `${slidesData.length} / ${slidesData.length}`;

            statusContent.appendChild(swiper);
            statusContent.appendChild(indicator);

            // Initial Load: Load the last slide (newest) and previous ones
            const lastIndex = slidesData.length - 1;
            loadSlideContent(lastIndex);
            if (lastIndex > 0) loadSlideContent(lastIndex - 1);
            if (lastIndex > 1) loadSlideContent(lastIndex - 2);

            // Scroll to the end (newest) initially
            setTimeout(() => {
                swiper.style.scrollBehavior = 'auto';
                swiper.scrollLeft = swiper.scrollWidth;
                setTimeout(() => {
                    swiper.style.scrollBehavior = 'smooth';
                }, 50);
            }, 0);

            // Scroll Listener for Indicator & Lazy Loading
            swiper.addEventListener('scroll', () => {
                const width = swiper.offsetWidth;
                if (width > 0) {
                    const currentIndex = Math.round(swiper.scrollLeft / width);
                    indicator.textContent = `${currentIndex + 1} / ${slidesData.length}`;
                    
                    // Lazy load adjacent slides (current +/- 2)
                    for (let i = currentIndex - 2; i <= currentIndex + 2; i++) {
                        loadSlideContent(i);
                    }
                }
            });

            if(!options.readOnly)window.attachStatusHistoryControls?.(char, statusContent, slidesData, swiper, indicator, options);
            statusOverlay.classList.add('visible');

};
