/*
	Class:    	ContextMenu
	Author:   	David Walsh
	Website:    http://davidwalsh.name
	Version:  	1.0
	Date:     	1/20/2009
	
	@modified   sandro -- replaced use of #href to store button info, moving to
	            an #id model, important to #addItem, #removeItem, #disableItem,
	            #enableItem, #getElements
	
	SAMPLE USAGE AT BOTTOM OF THIS FILE
	
*/

var ContextMenu = new Class({

	//implements
	Implements: [Options,Events],

	//options
	options: {
		actions: {},
		menu: 'contextmenu',
		stopEvent: true,
		targets: 'body',
		trigger: 'contextmenu',
		offsets: { x:0, y:0 },
		onShow: $empty,
		onHide: $empty,
		onClick: $empty,
		fadeSpeed: 200
	},
	
	//initialization
	initialize: function(options) {
		//set options
		this.setOptions(options)
		
		//option diffs menu
		this.menu = $(this.options.menu);
		this.targets = $$(this.options.targets);
		
		//fx
		this.fx = new Fx.Tween(this.menu, { 
		  property: 'opacity', 
		  duration:this.options.fadeSpeed 
		});
		
		//hide and begin the listener
		this.hide().startListener();
		
		//hide the menu
		this.menu.setStyles({ 
		  'position':'absolute',
		  'top':'-900000px', 
		  'display':'block' 
		});
	},
	

	//get things started
	startListener: function() {
		/* all elements */
		
		this.targets.each(function(el) {
			/* show the menu */
			
			/**
			 * This is the method which actually determines and draws 
			 * the menu on #trigger type of event.
			 */
			var _trigger = function(e) {
			  
			  /**
			   * Will need information on window and menu sizes below.
			   */
			  var wHeight, mHeight;
			  var mYPos = e.page.y + this.options.offsets.y;
			  var mXPos = e.page.x + this.options.offsets.x;
			  
				//enabled?
				if(!this.options.disabled) {
				  
					//prevent default, if told to
					if(this.options.stopEvent) { e.stop(); }
					
					//record this as the trigger
					this.options.element = $(el);
					
					/**
					 * id of node in tree.
					 */
			    var eId   = this.options.element.id;
			    
			    /**
			     * Collection?
			     */
			    var isColl = this.options.element.type === 'collection';
			    
			    /**
			     * Cups for user for this resource.
			     */
			    var Cups  = $AXIS.Editor.resourceById(eId).Cups;
			    
			    /**
			     * Function to add options.
			     */
			    var addOp = AXIS.curry(function(op)
			      {
			        /**
			         * Get some user permissions.
			         */
			        var canRead   = Cups.hasPrivilege('read');
			        var canWrite  = Cups.hasPrivilege('write');
			        
			        switch(op)
			          {
			            /**
			             * Most permissions require owner (ie. write perms).
			             */
			            case 'restore':
			            case 'rename':
			            case 'trash':
			            case 'delete':
			            case 'cut':
			            case 'duplicate':
			            case 'empty':
			            case 'folder_new':
			            case 'file_new':
			            case 'upload':
			            
			              if(canRead && canWrite)
			                {
			                  this.addItem(op);
			                }
			                
			            break;
			            
			            case 'paste':
			            
			              if( canRead 
			                  && canWrite 
			                  && $AXIS.Editor.clipboardEmpty === false 
			                  && isColl)
			                {
			                  this.addItem(op);
			                }
			            
			            break;
			            
			            /**
			             * Any folder can be refreshed
			             */
			            case 'refresh':
			              this.addItem(op);
			            break;
			            
			            /**
			             * Copy Bit. You must be signed in.
			             */
			            case 'copy':
			              if(AXIS.User.isLoggedIn())
			                {
			                  this.addItem(op);
			                }
			            break;
			            
			            default: 
			            break;  
			          }
			      }, this);
					
          /**
           * Customize Trash folder options (mainly, Delete and Restore
           * only shown for files within the Trash.
           */
          var url   = $AXIS.Editor.resourceById(eId).url;
          var tPath = $AXIS.Editor.userHomeUrl + '/trash';
          var tC    = url.substring(0,tPath.length);
          var tL    = url.length;
          var sp;

					/**
					 * Clear menu, then rebuild based on context.
					 */
					this.removeAll();

					if(tC === tPath)
					  {
					    if(tL > tPath.length)
					      {
					        addOp('delete'); 
					        addOp('copy');
					        
					        /**
					         * Restore option for trash is only active for the root-level
					         * of the trashed resource. If you trashed a collection which
					         * itself contained other collections, the interface will not
					         * allow you to restore the deeper resources (as without the
					         * complete path, understood as beginning with root, a
					         * containing collection does not exist for the deeper resource).
					         * Here we just see how many levels deeper than /trash the resource
					         * is, and if it is more than one, no `restore` option.
					         */
					        sp = url.replace(tPath+'/','').split('/');
					        if(sp.length === 1)
					          {
					            addOp('restore'); 
					          }
					      }
					    else if(tL === tPath.length)
					      {
					        addOp('duplicate');
					        addOp('copy');
					        addOp('refresh');
					        addOp('empty');
					      }
					  }
					else if(this.options.element.get('isroot') === 'true')
					  {
					    addOp('paste');
					    addOp('copy');
					  }
					else
					  {
					    /**
					     * All 'normal' files and folders get these
					     */
    					addOp('cut');
    					addOp('paste');
    					addOp('copy');
    					addOp('duplicate');
    					addOp('trash');
    					addOp('rename');
            }
            
					/**
					 * ALL folders get some added items, except for 
					 * trash folder, which has some mods.
					 */
					if(this.options.element.type == 'collection')
					  {
					    if(tC !== tPath)
					      {
					        addOp('folder_new');  
					        addOp('file_new');
                  addOp('refresh');
                  addOp('upload');
					      }
					  }

					  
					/**
					 * Position the menu.  Need to determine the size of the menu,
					 * and position it accordingly, mainly watching for bottom edge
					 * overflow. 
					 */
					mHeight = this.menu.getHeight();
					wHeight = document.body.getHeight();

					if((mYPos + mHeight) > wHeight)
					  {
					    mYPos -= (mYPos + mHeight) - wHeight;
					  }

					this.menu.setStyles({
						top: mYPos,
						left: mXPos,
						position: 'absolute',
						'z-index': '2000'
					});
					
					/**
					 * Now show the menu.  As it is possible that there are no valid actions
					 * for a selected resource (thereby creating an empty context menu), we
					 * just check for the height of the menu, and if it below the height of 
					 * a menu that has at least one element, do not show.  The number of children
					 * is not useful, as that is constant, with elements simply being hidden. I'd
					 * rather not bother writing a loop to check the class definition for each.
					 */
				  if(mHeight > 10)
				    {
				      this.show();
				    }
				  else
				    {
				      this.hide();
				    }
				}
			}.bind(this);
      
      /** 
       * Watch this... this code was originally designed for a single-pass insertion
       * of a context menu.  As our usage has the menus being constantly recreated and
       * changed, a problem arose where multiple events kept being piled on to the same
       * elements every time the DOM was searched for context-menu-enabled nodes.
       *
       * @see TreeControl.js
       */
      el.removeEvents();
      
			el.addEvent(this.options.trigger,_trigger);
			
		},this);
		
		/* menu items */
		this.menu.getElements('a').each(function(item) {
		  
		  /**
		   * See notes for removeEvents, above.
		   */
		  item.removeEvents();
		  
			item.addEvent('click',function(e) {
        this.executeMenuAction(item, e);
			}.bind(this));
		},this);
		
		//hide on body click
		$(document.body).addEvent('click', function() {
			this.hide();
		}.bind(this));
		
    $('treeFilesPanel').addEvent('scroll', function() {
			this.hide();
		}.bind(this));
	},
	
	//show menu
	show: function() {
		this.fx.start(1);
		this.fireEvent('show');
		this.shown = true;
		return this;
	},
	
	//hide the menu
	hide: function() {
		if(this.shown)
		{
			this.fx.start(0);
			this.fireEvent('hide');
			this.shown = false;
		}
		return this;
	},
	
	/**
	 * Makes all menu items invisible (menu shows nothing)
	 */
	removeAll: function() {
	  this.menu.getElements('a').addClass('removed');
	  return this;  
	},
	
	/**
	 * Makes a menu item invisible.
	 *
	 * @see #addItem
	 */
	removeItem: function(item) {
		this.menu.getElements('a[id$=' + item + ']').addClass('removed');
		return this;
	},
	
	/**
	 * Restores a removed item.
	 *
	 * @see #removeItem
	 */
	addItem: function(item) {
		this.menu.getElements('a[id$=' + item + ']').removeClass('removed');
		return this;
	},
	
	/**
	 * Item is visible, but non functional.
	 *
	 * @see #enableItem
	 */
	disableItem: function(item) {
		this.menu.getElements('a[id$=' + item + ']').addClass('disabled');
		return this;
	},
	
	/**
	 * Re-enables a disabled item.
	 *
	 * @see #disableItem
	 */
	enableItem: function(item) {
		this.menu.getElements('a[id$=' + item + ']').removeClass('disabled');
		return this;
	},
	
	/**
	 * Disables the entire menu.
	 *
	 * @see #enable
	 */
	disable: function() {
		this.options.disabled = true;
		return this;
	},
	
	/**
	 * Enables the entire menu.
	 *
	 * @see #disable
	 */
	enable: function() {
		this.options.disabled = false;
		return this;
	},
	
	/**
	 * Does the actual execution on a context menu item click.
	 */
	executeMenuAction: function(item, ev) 
  	{
  	  if(!item.hasClass('disabled')) 
    	  {
    		  var action = item.get('id').replace('ctxt_','');
    			var element = $(this.options.element);
          if(this.options.actions[action]) 
            {
          	  this.options.actions[action](element,this);
          	}
          return this;
    	  }
  	}
	
});

/* usage 
//once the DOM is ready
window.addEvent('domready', function() {
	var context = new ContextMenu({
		targets: 'a',
		menu: 'contextmenu',
		actions: {
			copy: function(element,ref) {
				element.setStyle('color','#090');
				alert('You selected the element that says: "' + element.get('text') + '."  I just changed the color green.');
				alert('Disabling the menu to show each individual action can control the menu instance.');
				ref.disable();
			}
		}
	});
	
	$('enable').addEvent('click',function(e) { e.stop(); context.enable(); alert('Menu Enabled.'); });
	$('disable').addEvent('click',function(e) { e.stop(); context.disable(); alert('Menu Disabled.'); });
	
	$('enable-copy').addEvent('click',function(e) { e.stop(); context.enableItem('copy'); alert('Copy Item Enabled.'); });
	$('disable-copy').addEvent('click',function(e) { e.stop(); context.disableItem('copy'); alert('Copy Item Disabled.'); });
	
});
*/