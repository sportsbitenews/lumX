(function()
{
    'use strict';

    angular
        .module('lumx.dropdown')
        .directive('lxDropdown', lxDropdown)
        .directive('lxDropdownToggle', lxDropdownToggle)
        .directive('lxDropdownMenu', lxDropdownMenu)
        .directive('lxDropdownFilter', lxDropdownFilter);

    function lxDropdown()
    {
        return {
            restrict: 'E',
            templateUrl: 'dropdown.html',
            scope:
            {
                closeOnClick: '=?lxCloseOnClick',
                effect: '@?lxEffect',
                escapeClose: '=?lxEscapeClose',
                hover: '=?lxHover',
                hoverDelay: '=?lxHoverDelay',
                minOffset: '=?lxMinOffset',
                offset: '@?lxOffset',
                overToggle: '=?lxOverToggle',
                position: '@?lxPosition',
                width: '@?lxWidth'
            },
            link: link,
            controller: LxDropdownController,
            controllerAs: 'lxDropdown',
            bindToController: true,
            transclude: true
        };

        function link(scope, element, attrs, ctrl)
        {
            var backwardOneWay = ['position', 'width'];
            var backwardTwoWay = ['escapeClose', 'overToggle'];

            angular.forEach(backwardOneWay, function(attribute)
            {
                if (angular.isDefined(attrs[attribute]))
                {
                    attrs.$observe(attribute, function(newValue)
                    {
                        scope.lxDropdown[attribute] = newValue;
                    });
                }
            });

            angular.forEach(backwardTwoWay, function(attribute)
            {
                if (angular.isDefined(attrs[attribute]))
                {
                    scope.$watch(function()
                    {
                        return scope.$parent.$eval(attrs[attribute]);
                    }, function(newValue)
                    {
                        scope.lxDropdown[attribute] = newValue;
                    });
                }
            });

            attrs.$observe('id', function(_newId)
            {
                ctrl.uuid = _newId;
            });

            scope.$on('$destroy', function()
            {
                if (ctrl.isOpen)
                {
                    ctrl.closeDropdownMenu();
                }
            });
        }
    }

    LxDropdownController.$inject = ['$element', '$interval', '$scope', '$timeout', '$window', 'LxDepthService',
        'LxDropdownService', 'LxEventSchedulerService', 'LxUtils'
    ];

    function LxDropdownController($element, $interval, $scope, $timeout, $window, LxDepthService,
        LxDropdownService, LxEventSchedulerService, LxUtils)
    {
        var lxDropdown = this;
        var dropdownInterval;
        var dropdownMenu;
        var dropdownToggle;
        var idEventScheduler;
        var openTimeout;
        var positionTarget;
        var scrollMask = angular.element('<div/>',
        {
            class: 'scroll-mask'
        });
        var enableBodyScroll;

        lxDropdown.closeDropdownMenu = closeDropdownMenu;
        lxDropdown.openDropdownMenu = openDropdownMenu;
        lxDropdown.registerDropdownMenu = registerDropdownMenu;
        lxDropdown.registerDropdownToggle = registerDropdownToggle;
        lxDropdown.toggle = toggle;
        lxDropdown.uuid = LxUtils.generateUUID();

        lxDropdown.closeOnClick = angular.isDefined(lxDropdown.closeOnClick) ? lxDropdown.closeOnClick : true;
        lxDropdown.effect = angular.isDefined(lxDropdown.effect) ? lxDropdown.effect : 'expand';
        lxDropdown.escapeClose = angular.isDefined(lxDropdown.escapeClose) ? lxDropdown.escapeClose : true;
        lxDropdown.hasToggle = false;
        lxDropdown.isOpen = false;
        lxDropdown.overToggle = angular.isDefined(lxDropdown.overToggle) ? lxDropdown.overToggle : false;
        lxDropdown.position = angular.isDefined(lxDropdown.position) ? lxDropdown.position : 'left';
        lxDropdown.minOffset = (angular.isUndefined(lxDropdown.minOffset) || lxDropdown.minOffset < 0) ? 8 : lxDropdown.minOffset;

        $scope.$on('lx-dropdown__open', function(_event, _params)
        {
            if (_params.uuid === lxDropdown.uuid && !lxDropdown.isOpen)
            {
                LxDropdownService.closeActiveDropdown();
                LxDropdownService.registerActiveDropdownUuid(lxDropdown.uuid);
                positionTarget = _params.target;

                registerDropdownToggle(positionTarget);
                openDropdownMenu();
            }
        });

        $scope.$on('lx-dropdown__close', function(_event, _params)
        {
            if (_params.uuid === lxDropdown.uuid && lxDropdown.isOpen && (!_params.documentClick || (_params.documentClick && lxDropdown.closeOnClick)))
            {
                closeDropdownMenu();
            }
        });

        $scope.$on('$destroy', function()
        {
            $timeout.cancel(openTimeout);
        });

        ////////////

        function closeDropdownMenu()
        {
            angular.element(window).off('resize', initDropdownPosition);

            $interval.cancel(dropdownInterval);

            LxDropdownService.resetActiveDropdownUuid();

            var velocityProperties;
            var velocityEasing;

            scrollMask.remove();

            if (angular.isFunction(enableBodyScroll)) {
                enableBodyScroll();
            }
            enableBodyScroll = undefined;

            var dropdownToggleElement;
            if (lxDropdown.hasToggle)
            {
                dropdownToggleElement = (angular.isString(dropdownToggle)) ? angular.element(dropdownToggle) : dropdownToggle;

                dropdownToggleElement
                    .off('wheel')
                    .css('z-index', '');
            }

            dropdownMenu
                .off('wheel')
                .css(
                {
                    overflow: 'hidden'
                });

            if (lxDropdown.effect === 'expand')
            {
                velocityProperties = {
                    width: 0,
                    height: 0
                };

                velocityEasing = 'easeOutQuint';
            }
            else if (lxDropdown.effect === 'fade')
            {
                velocityProperties = {
                    opacity: 0
                };

                velocityEasing = 'linear';
            }

            if (lxDropdown.effect === 'expand' || lxDropdown.effect === 'fade')
            {
                dropdownMenu.velocity(velocityProperties,
                {
                    duration: 200,
                    easing: velocityEasing,
                    complete: function()
                    {
                        dropdownMenu
                            .removeAttr('style')
                            .removeClass('dropdown-menu--is-open')
                            .appendTo($element.find('.dropdown'));

                        $scope.$apply(function()
                        {
                            lxDropdown.isOpen = false;

                            if (lxDropdown.escapeClose)
                            {
                                LxEventSchedulerService.unregister(idEventScheduler);
                                idEventScheduler = undefined;
                            }
                        });
                    }
                });
            }
            else if (lxDropdown.effect === 'none')
            {
                dropdownMenu
                    .removeAttr('style')
                    .removeClass('dropdown-menu--is-open')
                    .appendTo($element.find('.dropdown'));

                lxDropdown.isOpen = false;

                if (lxDropdown.escapeClose)
                {
                    LxEventSchedulerService.unregister(idEventScheduler);
                    idEventScheduler = undefined;
                }
            }
        }

        function getAvailableHeight()
        {
            var availableHeightOnTop;
            var availableHeightOnBottom;
            var direction;
            var dropdownToggleElement = (angular.isString(dropdownToggle)) ? angular.element(dropdownToggle) : dropdownToggle;
            var dropdownToggleHeight = dropdownToggleElement.outerHeight();
            var dropdownToggleTop = dropdownToggleElement.offset().top - angular.element($window).scrollTop();
            var windowHeight = $window.innerHeight;

            if (lxDropdown.overToggle)
            {
                availableHeightOnTop = dropdownToggleTop + dropdownToggleHeight;
                availableHeightOnBottom = windowHeight - dropdownToggleTop;
            }
            else
            {
                availableHeightOnTop = dropdownToggleTop;
                availableHeightOnBottom = windowHeight - (dropdownToggleTop + dropdownToggleHeight);
            }

            if (availableHeightOnTop > availableHeightOnBottom)
            {
                direction = 'top';
            }
            else
            {
                direction = 'bottom';
            }

            return {
                top: availableHeightOnTop,
                bottom: availableHeightOnBottom,
                direction: direction
            };
        }

        function initDropdownPosition()
        {
            var availableHeight = getAvailableHeight();
            var dropdownMenuWidth;
            var dropdownMenuLeft;
            var dropdownMenuRight;
            var dropdownToggleElement = (angular.isString(dropdownToggle)) ? angular.element(dropdownToggle) : dropdownToggle;
            var dropdownToggleWidth = dropdownToggleElement.outerWidth();
            var dropdownToggleHeight = dropdownToggleElement.outerHeight();
            var dropdownToggleTop = dropdownToggleElement.offset().top - angular.element($window).scrollTop();
            var windowWidth = $window.innerWidth;
            var windowHeight = $window.innerHeight;
            var cssProperties = {};

            if (angular.isDefined(lxDropdown.width))
            {
                if (lxDropdown.width.indexOf('%') > -1)
                {
                    dropdownMenuWidth = dropdownToggleWidth * (lxDropdown.width.slice(0, -1) / 100);
                    angular.extend(cssProperties,
                    {
                        minWidth: dropdownMenuWidth,
                    });
                }
                else
                {
                    dropdownMenuWidth = lxDropdown.width;
                    angular.extend(cssProperties,
                    {
                        width: dropdownMenuWidth,
                    });
                }
            }
            else
            {
                dropdownMenuWidth = 'auto';
                angular.extend(cssProperties,
                {
                    width: dropdownMenuWidth,
                });
            }


            if (lxDropdown.position === 'left')
            {
                dropdownMenuLeft = dropdownToggleElement.offset().left;
                dropdownMenuLeft = (dropdownMenuLeft <= lxDropdown.minOffset) ? lxDropdown.minOffset : dropdownMenuLeft;
                dropdownMenuRight = 'auto';
            }
            else if (lxDropdown.position === 'right')
            {
                dropdownMenuLeft = 'auto';
                dropdownMenuRight = windowWidth - dropdownToggleElement.offset().left - dropdownToggleWidth;
                dropdownMenuRight = (dropdownMenuRight > (windowWidth - lxDropdown.minOffset)) ? (windowWidth - lxDropdown.minOffset) : dropdownMenuRight;
            }
            else if (lxDropdown.position === 'center')
            {
                dropdownMenuLeft = (dropdownToggleElement.offset().left + (dropdownToggleWidth / 2)) - (dropdownMenuWidth / 2);
                dropdownMenuLeft = (dropdownMenuLeft <= lxDropdown.minOffset) ? lxDropdown.minOffset : dropdownMenuLeft;
                dropdownMenuRight = 'auto';
            }

            angular.extend(cssProperties,
            {
                left: dropdownMenuLeft,
                right: dropdownMenuRight,
            });

            dropdownMenu.css(cssProperties);

            if (availableHeight.direction === 'top')
            {
                dropdownMenu.css(
                {
                    bottom: lxDropdown.overToggle ? (windowHeight - dropdownToggleTop - dropdownToggleHeight) : (windowHeight - dropdownToggleTop + ~~lxDropdown.offset)
                });

                return availableHeight.top;
            }
            else if (availableHeight.direction === 'bottom')
            {
                dropdownMenu.css(
                {
                    top: lxDropdown.overToggle ? dropdownToggleTop : (dropdownToggleTop + dropdownToggleHeight + ~~lxDropdown.offset)
                });

                return availableHeight.bottom;
            }
        }

        function openDropdownMenu()
        {
            lxDropdown.isOpen = true;

            LxDepthService.register();

            scrollMask
                .css('z-index', LxDepthService.getDepth())
                .appendTo('body');

            scrollMask.on('wheel', function preventDefault(e) {
                e.preventDefault();
            });

            angular.element(window).on('resize', initDropdownPosition);

            enableBodyScroll = LxUtils.disableBodyScroll();

            var dropdownToggleElement;
            if (lxDropdown.hasToggle)
            {
                dropdownToggleElement = (angular.isString(dropdownToggle)) ? angular.element(dropdownToggle) : dropdownToggle;
                dropdownToggleElement
                    .css('z-index', LxDepthService.getDepth() + 1)
                    .on('wheel', function preventDefault(e) {
                        e.preventDefault();
                    });
            }

            dropdownMenu
                .addClass('dropdown-menu--is-open')
                .css('z-index', LxDepthService.getDepth() + 1)
                .appendTo('body');

            dropdownMenu.on('wheel', function preventDefault(e) {
                var d = e.originalEvent.deltaY;

                if (d < 0 && dropdownMenu.scrollTop() === 0) {
                    e.preventDefault();
                }
                else {
                    if (d > 0 && (dropdownMenu.scrollTop() == dropdownMenu.get(0).scrollHeight - dropdownMenu.innerHeight())) {
                        e.preventDefault();
                    }
                }
            });

            if (lxDropdown.escapeClose)
            {
                idEventScheduler = LxEventSchedulerService.register('keyup', onKeyUp);
            }

            openTimeout = $timeout(function()
            {
                var availableHeight = initDropdownPosition() - ~~lxDropdown.offset;
                var dropdownMenuHeight = dropdownMenu.outerHeight();
                var dropdownMenuWidth = dropdownMenu.outerWidth();
                var enoughHeight = true;

                if (availableHeight < dropdownMenuHeight)
                {
                    enoughHeight = false;
                    dropdownMenuHeight = availableHeight;
                }

                if (lxDropdown.effect === 'expand')
                {
                    dropdownMenu.css(
                    {
                        width: 0,
                        height: 0,
                        opacity: 1,
                        overflow: 'hidden'
                    });

                    dropdownMenu.find('.dropdown-menu__content').css(
                    {
                        width: dropdownMenuWidth,
                        height: dropdownMenuHeight
                    });

                    dropdownMenu.velocity(
                    {
                        width: dropdownMenuWidth
                    },
                    {
                        duration: 200,
                        easing: 'easeOutQuint',
                        queue: false
                    });

                    dropdownMenu.velocity(
                    {
                        height: dropdownMenuHeight
                    },
                    {
                        duration: 500,
                        easing: 'easeOutQuint',
                        queue: false,
                        complete: function()
                        {
                            dropdownMenu.css(
                            {
                                overflow: 'auto'
                            });

                            if (angular.isUndefined(lxDropdown.width))
                            {
                                dropdownMenu.css(
                                {
                                    width: 'auto'
                                });
                            }

                            $timeout(updateDropdownMenuHeight);

                            dropdownMenu.find('.dropdown-menu__content').removeAttr('style');

                            dropdownInterval = $interval(updateDropdownMenuHeight, 500);
                        }
                    });
                }
                else if (lxDropdown.effect === 'fade')
                {
                    dropdownMenu.css(
                    {
                        height: dropdownMenuHeight
                    });

                    dropdownMenu.velocity(
                    {
                        opacity: 1,
                    },
                    {
                        duration: 200,
                        easing: 'linear',
                        queue: false,
                        complete: function()
                        {
                            $timeout(updateDropdownMenuHeight);

                            dropdownInterval = $interval(updateDropdownMenuHeight, 500);
                        }
                    });
                }
                else if (lxDropdown.effect === 'none')
                {
                    dropdownMenu.css(
                    {
                        opacity: 1
                    });

                    $timeout(updateDropdownMenuHeight);

                    dropdownInterval = $interval(updateDropdownMenuHeight, 500);
                }
            });
        }

        function onKeyUp(_event)
        {
            if (_event.keyCode == 27)
            {
                closeDropdownMenu();
            }

            _event.stopPropagation();
        }

        function registerDropdownMenu(_dropdownMenu)
        {
            dropdownMenu = _dropdownMenu;
        }

        function registerDropdownToggle(_dropdownToggle)
        {
            if (!positionTarget)
            {
                lxDropdown.hasToggle = true;
            }

            dropdownToggle = _dropdownToggle;
        }

        function toggle()
        {
            if (!lxDropdown.isOpen)
            {
                openDropdownMenu();
            }
            else
            {
                closeDropdownMenu();
            }
        }

        function updateDropdownMenuHeight()
        {
            if (positionTarget)
            {
                registerDropdownToggle(angular.element(positionTarget));
            }

            if (!angular.element(dropdownToggle).is(':visible')) {
                return;
            }

            var availableHeight = getAvailableHeight();
            var dropdownMenuHeight = dropdownMenu.find('.dropdown-menu__content').outerHeight();

            dropdownMenu.css(
            {
                height: 'auto'
            });

            if ((availableHeight[availableHeight.direction] - ~~lxDropdown.offset) < dropdownMenuHeight)
            {
                if (availableHeight.direction === 'top')
                {
                    dropdownMenu.css(
                    {
                        top: 0
                    });
                }
                else if (availableHeight.direction === 'bottom')
                {
                    dropdownMenu.css(
                    {
                        bottom: 0
                    });
                }
            }
            else
            {
                if (availableHeight.direction === 'top')
                {
                    dropdownMenu.css(
                    {
                        top: 'auto'
                    });
                }
                else if (availableHeight.direction === 'bottom')
                {
                    dropdownMenu.css(
                    {
                        bottom: 'auto'
                    });
                }
            }
        }
    }

    lxDropdownToggle.$inject = ['$timeout', '$window', 'LxDropdownService'];

    function lxDropdownToggle($timeout, $window, LxDropdownService)
    {
        return {
            restrict: 'AE',
            templateUrl: 'dropdown-toggle.html',
            require: '^lxDropdown',
            scope: true,
            link: link,
            replace: true,
            transclude: true
        };

        function link(scope, element, attrs, ctrl)
        {
            var hoverTimeout = [];
            var mouseEvent = ctrl.hover ? 'mouseenter' : 'click';

            ctrl.registerDropdownToggle(element);

            element.on(mouseEvent, function(_event)
            {
                // If we are in mobile, ignore the mouseenter event for hovering detection
                if (mouseEvent === 'mouseenter' && ('ontouchstart' in window && angular.element($window).outerWidth() <= 480)) {
                    return;
                }

                if (!ctrl.hover)
                {
                    _event.stopPropagation();
                }

                LxDropdownService.closeActiveDropdown();
                LxDropdownService.registerActiveDropdownUuid(ctrl.uuid);

                if (ctrl.hover)
                {
                    ctrl.mouseOnToggle = true;

                    if (!ctrl.isOpen)
                    {
                        hoverTimeout[0] = $timeout(function()
                        {
                            scope.$apply(function()
                            {
                                ctrl.openDropdownMenu();
                            });
                        }, ctrl.hoverDelay);
                    }
                }
                else
                {
                    scope.$apply(function()
                    {
                        ctrl.toggle();
                    });
                }
            });

            if (ctrl.hover)
            {
                element.on('mouseleave', function()
                {
                    ctrl.mouseOnToggle = false;

                    $timeout.cancel(hoverTimeout[0]);

                    hoverTimeout[1] = $timeout(function()
                    {
                        if (!ctrl.mouseOnMenu)
                        {
                            scope.$apply(function()
                            {
                                ctrl.closeDropdownMenu();
                            });
                        }
                    }, ctrl.hoverDelay);
                });
            }

            scope.$on('$destroy', function()
            {
                element.off();

                if (ctrl.hover)
                {
                    $timeout.cancel(hoverTimeout[0]);
                    $timeout.cancel(hoverTimeout[1]);
                }
            });
        }
    }

    lxDropdownMenu.$inject = ['$timeout'];

    function lxDropdownMenu($timeout)
    {
        return {
            restrict: 'E',
            templateUrl: 'dropdown-menu.html',
            require: ['lxDropdownMenu', '^lxDropdown'],
            scope: true,
            link: link,
            controller: LxDropdownMenuController,
            controllerAs: 'lxDropdownMenu',
            bindToController: true,
            replace: true,
            transclude: true
        };

        function link(scope, element, attrs, ctrls)
        {
            var hoverTimeout;

            ctrls[1].registerDropdownMenu(element);
            ctrls[0].setParentController(ctrls[1]);

            if (ctrls[1].hover)
            {
                element.on('mouseenter', function()
                {
                    ctrls[1].mouseOnMenu = true;
                });

                element.on('mouseleave', function()
                {
                    ctrls[1].mouseOnMenu = false;

                    hoverTimeout = $timeout(function()
                    {
                        if (!ctrls[1].mouseOnToggle)
                        {
                            scope.$apply(function()
                            {
                                ctrls[1].closeDropdownMenu();
                            });
                        }
                    }, ctrls[1].hoverDelay);
                });
            }

            scope.$on('$destroy', function()
            {
                if (ctrls[1].hover)
                {
                    element.off();
                    $timeout.cancel(hoverTimeout);
                }
            });
        }
    }

    LxDropdownMenuController.$inject = ['$element'];

    function LxDropdownMenuController($element)
    {
        var lxDropdownMenu = this;

        lxDropdownMenu.setParentController = setParentController;

        ////////////

        function setParentController(_parentCtrl)
        {
            lxDropdownMenu.parentCtrl = _parentCtrl;
        }
    }

    lxDropdownFilter.$inject = ['$timeout'];

    function lxDropdownFilter($timeout)
    {
        return {
            restrict: 'A',
            link: link
        };

        function link(scope, element)
        {
            var focusTimeout;

            element.on('click', function(_event)
            {
                _event.stopPropagation();
            });

            focusTimeout = $timeout(function()
            {
                element.find('input').focus();
            }, 200);

            scope.$on('$destroy', function()
            {
                $timeout.cancel(focusTimeout);
                element.off();
            });
        }
    }
})();
