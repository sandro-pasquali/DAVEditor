/*
 * @author Sandro Pasquali (spasquali@gmail.com)
 */
var TreeControl = function(ob) 
  {
    ob = ob || {};
    
    var DomContainerId  = ob.containerId || 'container_treeFilesPanel';
    var mode            = ob.mode || 'files';
    var grid            = ob.grid === undefined ? true : false;
    var isOpen          = ob.open === undefined ? true : false;
    
    var fileTips        = !!ob.fileTips;
    var contextMenu     = !!ob.contextMenu;
    
    var controller      = ob.controller || {};
    var rootLabel       = ob.rootLabel || '';
    
    var treeUrl         = ob.treeUrl || '/';
    var rootId          = $AXIS.Editor.getId(treeUrl);

    /**
     * Hidden file types.  These are determined by file extension only.
     *
     * @see #_loaded
     */
    var hiddenFiles     = [
      'DS_Store',
      'hidden'
    ];

    /**
    	My Object Oriented Tree
    	- Developed by Rasmus Schultz, <http://www.mindplay.dk>
    	- Tested with MooTools release 1.2, under Firefox 2, Opera 9 and Internet Explorer 6 and 7.
    	
    License:
    	MIT-style license.
    
    Credits:
    	Inspired by:
    	- WebFX xTree, <http://webfx.eae.net/dhtml/xtree/>
    	- Destroydrop dTree, <http://www.destroydrop.com/javascripts/tree/>
    	
    Changes:
    	
    	rev.12:
    	- load() only worked once on the same node, fixed.
    	- the script would sometimes try to get 'R' from the server, fixed.
    	- the 'load' attribute is now supported in XML files (see example_5.html).
    	
    	rev.13:
    	- enable() and disable() added - the adopt() and load() methods use these to improve performance by minimizing the number of visual updates.
    	
    	rev.14:
    	- toggle() was using enable() and disable() which actually caused it to do extra work - fixed.
    	
    	rev.15:
    	- adopt() now picks up 'href', 'target', 'title' and 'name' attributes of the a-tag, and stores them in the data object.
    	- adopt() now picks up additional constructor arguments from embedded comments, e.g. icons, colors, etc.
    	- documentation now generates properly with NaturalDocs, <http://www.naturaldocs.org/>
    	
    	rev.16:
    	- onClick events added to MooTreeControl and MooTreeNode
    	- nodes can now have id's - <MooTreeControl.get> method can be used to find a node with a given id
    	
    	rev.17:
    	- changed icon rendering to use innerHTML, making the control faster (and code size slightly smaller).
    	
    	rev.18:
    	- migrated to MooTools 1.2 (previous versions no longer supported)
    	
    	sandro@limebits.com
    	- Major rewrite and integration with editing system.  Addition of new tree control methods, tooltips, file tracking and loading (involving expansion of node rendering and definition w/ model reflecting node data), implementation of context menu, complete rewrite of filesystem request/load/process methods and flow, general refactoring where appropriate, elimination of some redundant code, etc.
    	
    */
    
    var MooTreeIcon = ['I','L','Lminus','Lplus','Rminus','Rplus','T','Tminus','Tplus','_closed','_doc','_open','minus','plus'];
    
    /*
    Class: MooTreeControl
    	This class implements a tree control.
    
    Properties:
    	root - returns the root <MooTreeNode> object.
    	selected - returns the currently selected <MooTreeNode> object, or null if nothing is currently selected.
    
    Events:
    	onExpand - called when a node is expanded or collapsed: function(node, state) - where node is the <MooTreeNode> object that fired the event, and state is a boolean meaning true:expanded or false:collapsed.
    	onSelect - called when a node is selected or deselected: function(node, state) - where node is the <MooTreeNode> object that fired the event, and state is a boolean meaning true:selected or false:deselected.
    	onClick - called when a node is clicked: function(node) - where node is the <MooTreeNode> object that fired the event.
    
    Parameters:
    	The constructor takes two object parameters: config and options.
    	The first, config, contains global settings for the tree control - you can use the configuration options listed below.
    	The second, options, should contain options for the <MooTreeNode> constructor - please refer to the options listed in the <MooTreeNode> documentation.
    
    Config:
    	div - a string representing the div Element inside which to build the tree control.
    	mode - optional string, defaults to 'files' - specifies default icon behavior. In 'files' mode, empty nodes have a document icon - whereas, in 'folders' mode, all nodes are displayed as folders (a'la explorer).
    	grid - boolean, defaults to false. If set to true, a grid is drawn to outline the structure of the tree.
    	
    	theme - string, optional, defaults to 'tree.png' - specifies the 'theme' image to use, which is a filmstrip image.
    	
    	loader - optional, an options object for the <MooTreeNode> constructor - defaults to {icon:'mootree_loader.gif', text:'Loading...', color:'a0a0a0'}
    	
    	onExpand - optional function (see Events above)
    	onSelect - optional function (see Events above)
    
    */
    
    var MooTreeControl = new Class({
    	
    	initialize: function(config, options) {
    		
    		options.control = this;               // make sure our new MooTreeNode knows who it's owner control is
    		options.div = config.div;             // tells the root node which div to insert itself into
    		this.root = new MooTreeNode(options); // create the root node of this tree control
    		
    		this.index = {};            // used by the get() method
    		
    		this.enabled = true;                  // enable visual updates of the control
    		
    		this.theme = config.theme || 'tree.png';
    		
    		this.loader = config.loader || {icon:'mootree_loader.gif', text:'Loading...', color:'#a0a0a0'};
    		
    		this.selected = null;                 // set the currently selected node to nothing
    		this.mode = config.mode;              // mode can be "folders" or "files", and affects the default icons
    		this.grid = config.grid;              // grid can be turned on (true) or off (false)
    		
    		this.onExpand = config.onExpand || AXIS.F; // called when any node in the tree is expanded/collapsed
    		this.onSelect = config.onSelect || AXIS.F; // called when any node in the tree is selected/deselected
    		this.onClick = config.onClick || AXIS.F; // called when any node in the tree is clicked
    		
    		this.root.update(true);
    		
    	},
    	
    	/*
    	Property: insert
    		Creates a new node under the root node of this tree.
    	
    	Parameters:
    		options - an object containing the same options available to the <MooTreeNode> constructor.
    		
    	Returns:
    		A new <MooTreeNode> instance.
    	*/
    	
    	insert: function(options) {
    		options.control = this;
    		return this.root.insert(options);
    	},
    	
    	/*
    	Property: select
    		Sets the currently selected node.
    		This is called by <MooTreeNode> when a node is selected (e.g. by clicking it's title with the mouse).
    	
    	Parameters:
    		node - the <MooTreeNode> object to select.
    	*/
    	
    	select: function(node) 
      	{
      	  if(node)
      	    {
          		if(this.selected === node) 
          		  {
          		    return; // already selected
          		  }
          		  
          		if(this.selected) 
          		  {
            			// deselect previously selected node:
            			this.selected.select(false);
            			this.onSelect(this.selected, false);
          		  }
          		  
          		// select new node:
          		this.selected = node;
          		node.select(true);
          		this.onSelect(node, true);
            }
      	},
      
      open: function(node)
        {
          this.onClick(node);
        },
    	
    	/*
    	Property: expand
    		Expands the entire tree, recursively.
    	*/
    	
    	expand: function() {
    		this.root.toggle(true, true);
    	},
    
    	/*
    	Property: collapse
    		Collapses the entire tree, recursively.
    	*/
    
    	collapse: function() {
    		this.root.toggle(true, false);
    	},
    	
    	/*
    	Property: get
    		Retrieves the node with the given id - or null, if no node with the given id exists.
    	
    	Parameters:
    		id - a string, the id of the node you wish to retrieve.
    	
    	Note:
    		Node id can be assigned via the <MooTreeNode> constructor, e.g. using the <MooTreeNode.insert> method.
    	*/
    	
    	get: function(id) {
    		return this.index[id] || null;
    	},
    	
    	/*
    	Property: adopt
    		Adopts a structure of nested ul/li/a elements as tree nodes, then removes the original elements.
    	
    	Parameters:
    		id - a string representing the ul element to be adopted, or an element reference.
    		parentNode - optional, a <MooTreeNode> object under which to import the specified ul element. Defaults to the root node of the parent control.
    	
    	Note:
    		The ul/li structure must be properly nested, and each li-element must contain one a-element, e.g.:
    		
    		><ul id="mytree">
    		>  <li><a href="test.html">Item One</a></li>
    		>  <li><a href="test.html">Item Two</a>
    		>    <ul>
    		>      <li><a href="test.html">Item Two Point One</a></li>
    		>      <li><a href="test.html">Item Two Point Two</a></li>
    		>    </ul>
    		>  </li>
    		>  <li><a href="test.html"><!-- icon:_doc; color:#ff0000 -->Item Three</a></li>
    		></ul>
    		
    		The "href", "target", "title" and "name" attributes of the a-tags are picked up and stored in the
    		data property of the node.
    		
    		CSS-style comments inside a-tags are parsed, and treated as arguments for <MooTreeNode> constructor,
    		e.g. "icon", "openicon", "color", etc.
    	*/
    	
    	adopt: function(id, parentNode) 
      	{
      		if(parentNode === undefined) 
      		  {
      		    parentNode = this.root;
      		  }
      		this.disable();
      		this._adopt(id, parentNode);
      		parentNode.update(true);
      		$(id).destroy();
      		this.enable();
      	},
    	
    	_adopt: function(id, parentNode) 
      	{
      		/* adopts a structure of ul/li elements into this tree */
      		e = $(id);
      		var i=0, c = e.getChildren();
      		for(i=0; i<c.length; i++) 
        		{
        			if(c[i].nodeName == 'LI') 
          			{
          				var con={text:''}, comment='', node=null, subul=null;
          				var n=0, z=0, se=null, s = c[i].getChildren();
          				for(n=0; n<s.length; n++) 
            				{
            					switch(s[n].nodeName) 
              					{
              						case 'A':
              							for(z=0; z<s[n].childNodes.length; z++) 
                							{
                								se = s[n].childNodes[z];
                								switch(se.nodeName) 
                  								{
                  									case '#text': con.text += se.nodeValue; break;
                  									case '#comment': comment += se.nodeValue; break;
                  								}
                							}
              							con.data = s[n].getProperties('href','target','title','name');
              						break;
              						case 'UL':
              							subul = s[n];
              						break;
              					}
            				}
          				if (con.label != '') 
            				{
            					con.data.url = con.data['href']; // (for backwards compatibility)
            					if(comment != '') 
              					{
              						var bits = comment.split(';');
              						for(z=0; z<bits.length; z++) 
                						{
                							var pcs = bits[z].trim().split(':');
                							if(pcs.length == 2) 
                							  {
                							    con[pcs[0].trim()] = pcs[1].trim();
                							  }
                						}
              					}
            
            					node = parentNode.insert(con);
            					if(subul) 
            					  {
            					    this._adopt(subul, node);
            					  }
            				}
          			}
        		}
      	},
    		
    	/*
    	Property: disable
    		Call this to temporarily disable visual updates -- if you need to insert/remove many nodes
    		at a time, many visual updates would normally occur. By temporarily disabling the control,
    		these visual updates will be skipped.
    		
    		When you're done making changes, call <MooTreeControl.enable> to turn on visual updates
    		again, and automatically repaint all nodes that were changed.
    	*/
    	
    	disable: function() {
    		this.enabled = false;
    	},
    	
    	/*
    	Property: enable
    		Enables visual updates again after a call to <MooTreeControl.disable>
    	*/
    
    	enable: function() {
    		this.enabled = true;
    		this.root.update(true, true);
    	}
    	
    });

    /*
    Class: MooTreeNode
    	This class implements the functionality of a single node in a <MooTreeControl>.
    
    Note:
    	You should not manually create objects of this class -- rather, you should use
    	<MooTreeControl.insert> to create nodes in the root of the tree, and then use
    	the similar function <MooTreeNode.insert> to create subnodes.
    	
    	Both insert methods have a similar syntax, and both return the newly created
    	<MooTreeNode> object.
    
    Parameters:
    	options - an object. See options below.
    
    Options:
    	text - this is the displayed text of the node, and as such as is the only required parameter.
    	id - string, optional - if specified, must be a unique node identifier. Nodes with id can be retrieved using the <MooTreeControl.get> method.
    	color - string, optional - if specified, must be a six-digit hexadecimal RGB color code.
    	
    	open - boolean value, defaults to false. Use true if you want the node open from the start.
    	
    	icon - use this to customize the icon of the node. The following predefined values may be used: '_open', '_closed' and '_doc'. Alternatively, specify the URL of a GIF or PNG image to use - this should be exactly 18x18 pixels in size. If you have a strip of images, you can specify an image number (e.g. 'my_icons.gif#4' for icon number 4).
    	openicon - use this to customize the icon of the node when it's open.
    	
    	data - an object containing whatever data you wish to associate with this node (such as an url and/or an id, etc.)
    
    Events:
    	onExpand - called when the node is expanded or collapsed: function(state) - where state is a boolean meaning true:expanded or false:collapsed.
    	onSelect - called when the node is selected or deselected: function(state) - where state is a boolean meaning true:selected or false:deselected.
    	onClick - called when the node is clicked (no arguments).
    */
    
    var MooTreeNode = new Class({
    	
    	initialize: function(options) {

    		this.text = options.text;       // the text displayed by this node
    		this.id = options.id || null;   // the node's unique id
    		this.nodes = [];                // subnodes nested beneath this node (MooTreeNode objects)
    		this.parent = null;             // this node's parent node (another MooTreeNode object)
    		this.last = true;               // a flag telling whether this node is the last (bottom) node of it's parent
    		this.control = options.control; // owner control of this node's tree
    		this.selected = false;          // a flag telling whether this node is the currently selected node in it's tree
    		
    		this.color = options.color || null; // text color of this node
    		
    		this.data = options.data || {}; // optional object containing whatever data you wish to associate with the node (typically an url or an id)
    		
    		this.onExpand = options.onExpand || AXIS.F; // called when the individual node is expanded/collapsed
    		this.onSelect = options.onSelect || AXIS.F; // called when the individual node is selected/deselected
    		this.onClick = options.onClick || AXIS.F; // called when the individual node is clicked
    		
    		this.open = options.open ? true : false; // flag: node open or closed?
    		
    		this.icon = options.icon;
    		this.openicon = options.openicon || this.icon;
    		
    		// add the node to the control's node index:
    		if(this.id) 
    		  {
    		    this.control.index[this.id] = this;
    		  }

    		// create the necessary divs:
    		this.div = {
    			main:     new Element('div').addClass('TreeControl_node'),
    			indent:   new Element('div'),
    			gadget:   new Element('div'),
    			icon:     new Element('div'),
    			text:     new Element('a').addClass('TreeControl_text'),
    			sub:      new Element('div')
    		}
    		
    		/**
    		 * Root node: some special considerations here, mainly because
    		 * the root node is not adopted into the internal model in the
    		 * same way that leaf nodes are.
    		 */
    		if(options.div && options.div == DomContainerId)
    		  {
    		    this.div.text.set('type','collection');
    		    this.div.text.set('id', rootId);
    		    this.div.text.set('isroot','true');
    		    
    		    this.data.type        = 'collection';
    		  }
    		
    		/**
    		 * This is mainly used by context menu
    		 */
    		else if(options.data)
    		  {
    		    this.div.text.set('type', options.data.type);  
    		    this.div.text.set('id', options.id);
    		  }

    		// put the other divs under the main div:
    		this.div.main.adopt(this.div.indent);
    		this.div.main.adopt(this.div.gadget);
    		this.div.main.adopt(this.div.icon);
    		this.div.main.adopt(this.div.text);
    
    		// put the main and sub divs in the specified parent div:
    		$(options.div).adopt(this.div.main);
    		$(options.div).adopt(this.div.sub);
    		
    		/**
    		 * Attach event handler to gadget.
    		 */
    		this.div.gadget._node = this;
    		this.div.gadget.onclick = function() 
    		  {
    			  this._node.toggle();
    		  };
    		
    		/**
    		 * Attach event handler to icon/text.
    		 */
    		this.div.icon._node = this.div.text._node = this;
    		
      	this.div.icon.onclick = 
      	this.div.text.onclick = 
      	function() 
      	  {
      	    if(this._node.data.type === 'collection')
      	      {
      	        this._node.control.select(this._node);
                
      	      }
      			else
      			  {
      			    this._node.control.open(this._node);
      			  }
      		}
      	
      	/**
      	 * Open folders/files on doubleclick.
      	 */
      	this.div.icon.ondblclick = 
      	this.div.text.ondblclick =
      	function() 
      	  {
      	    if(this._node.data.type === 'collection')
      	      {
                this._node.toggle();
      	      }
      	    else
      	      {
      	        this._node.control.open(this._node) 
      	      }
      		}
    		
    		/**
    		 * If a mouse goes down, check if a context menu (right click) request.
    		 */
    		this.div.text.onmousedown = function(ev){ 
    		  var e = ev || window.event;
    		  if(e.button == 2)
    		    {
    		      this._node.control.select(this._node);
    		    }
    		} 
    		 		
    	},
    	
    	/*
    	Property: insert
    		Creates a new node, nested inside this one.
    	
    	Parameters:
    		options - an object containing the same options available to the <MooTreeNode> constructor.
    
    	Returns:
    		A new <MooTreeNode> instance.
    	*/
    	
    	insert: function(options) 
      	{		
      		// set the parent div and create the node:
      		options.div = this.div.sub;
      		options.control = this.control;
      		var node = new MooTreeNode(options);
      		
      		// set the new node's parent:
      		node.parent = this;
      		
      		// mark this node's last node as no longer being the last, then add the new last node:
      		var n = this.nodes;
      		if (n.length) n[n.length-1].last = false;
      		n.push(node);
      		
      		// repaint the new node:
      		node.update();
      		
      		// repaint the new node's parent (this node):
      		if(n.length == 1) 
      		  {
      		    this.update();
      		  }
      		
      		// recursively repaint the new node's previous sibling node:
      		if(n.length > 1) 
      		  {
      		    n[n.length-2].update(true);
      		  }
      		
      		return node;
      		
      	},
    	
    	/*
    	Property: remove
    		Removes this node, and all of it's child nodes. If you want to remove all the childnodes without removing the node itself, use <MooTreeNode.clear>
    	*/
    	
    	remove: function() 
      	{
      		var p = this.parent;
      		this._remove();
      		p.update(true);
      	},
    	
    	_remove: function() 
      	{
      		
      		// recursively remove this node's subnodes:
      		var n = this.nodes;
      		while(n.length) 
      		  {
      		    n[n.length-1]._remove();
      		  }
      		
      		// remove the node id from the control's index:
      		delete this.control.index[this.id];
      		
      		// remove this node's divs:
      		this.div.main.destroy();
      		this.div.sub.destroy();
      		
      		if(this.parent) 
      		  {
      			
      			  // remove this node from the parent's collection of nodes:
      			  var p = this.parent.nodes;
      			  p.erase(this);
      			
      			  /**
      			   * In case we removed the parent's last node, flag it's current 
      			   * last node as being the last.
      			   */
      			  if (p.length) p[p.length-1].last = true;
      		  }
      	},
    	
    	/*
    	Property: clear
    		Removes all child nodes under this node, without removing the node itself.
    		To remove all nodes including this one, use <MooTreeNode.remove>
    	*/
    	
    	clear: function() 
      	{
      		this.control.disable();
      		while(this.nodes.length) 
      		  {
      		    this.nodes[this.nodes.length-1].remove();
      		  }
      		this.control.enable();
      	},
    
    	/*
    	Property: update
    		Update the tree node's visual appearance.
    	
    	Parameters:
    		recursive - boolean, defaults to false. If true, recursively updates all nodes beneath this one.
    		invalidated - boolean, defaults to false. If true, updates only nodes that have been invalidated while the control has been disabled.
    	*/
    	
    	update: function(recursive, invalidated) 
      	{
      		
      		var draw = true;
      		
      		if(!this.control.enabled) 
        		{
        			// control is currently disabled, so we don't do any visual updates
        			this.invalidated = true;
        			draw = false;
        		}
      		
      		if(invalidated) 
        		{
        			if(!this.invalidated) 
          			{
          				draw = false; // this one is still valid, don't draw
          			} 
          	  else 
          	    {
          				this.invalidated = false; // we're drawing this item now
          			}
        		}
      		
      		if(draw) 
        		{
        			var x;
        			
        			/**
        			 * Make the node selected, or not
        			 */
        			this.div.main.className = 'TreeControl_node' + (this.selected ? ' TreeControl_selected' : '');
        			
        			// update indentations:
        			var p = this, i = '';
        			while(p.parent) 
        			  {
        				  p = p.parent;
        				  i = this.getImg(p.last || !this.control.grid ? '' : 'I') + i;
        			  }
        			this.div.indent.innerHTML = i;
        			
        			// update the text:
        			x = this.div.text;
        			x.empty();
        			x.appendText(decodeURIComponent(this.text));
        			
        			if(this.color) 
        			  {
        			    x.style.color = this.color;
        			  }
    
        			// update the icon:
        			this.div.icon.innerHTML = this.getImg(  this.nodes.length 
        			                                        ? ( this.open 
        			                                            ? (this.openicon || this.icon || '_open') : (this.icon || '_closed') ) 
        			                                        : ( this.icon || 
        			                                            ( this.control.mode == 'folders' 
        			                                              ? '_closed' 
        			                                              : '_doc') ) );
        			
        			// update the plus/minus gadget:
        			this.div.gadget.innerHTML = this.getImg(( this.control.grid 
        			                                          ? ( this.control.root == this 
        			                                              ? ( this.nodes.length 
        			                                                  ? 'R' 
        			                                                  : '') 
        			                                              : ( this.last
        			                                                  ? 'L'
        			                                                  : 'T') ) 
        			                                          : '') + ( this.nodes.length 
        			                                                    ? ( this.open 
        			                                                        ?'minus' 
        			                                                        :'plus' ) 
        			                                                    : '') );
        			
        			// show/hide subnodes:
        			this.div.sub.style.display = this.open ? 'block' : 'none';
        		}
      		
      		// if recursively updating, update all child nodes:
      		if(recursive) 
      		  { 
      		    this.nodes.forEach(function(node) {
      			    node.update(true, invalidated);
      		    });
      		  }
      		
      	},
    	
    	/*
    	Property: getImg
    		Creates a new image, in the form of HTML for a DIV element with appropriate style.
    		You should not need to manually call this method. (though if for some reason you want to, you can)
    	
    	Parameters:
    		name - the name of new image to create, defined by <MooTreeIcon> or located in an external file.
    	
    	Returns:
    		The HTML for a new div Element.
    	*/
    	
    	getImg: function(name) 
      	{
      		var html = '<div class="TreeControl_img"';
      		
      		if(name != '') 
        		{
        			var img = this.control.theme;
        			var i = MooTreeIcon.indexOf(name);
        			if(i == -1) 
          			{
          				// custom (external) icon:
          				var x = name.split('#');
          				img = x[0];
          				i = (x.length == 2 ? parseInt(x[1])-1 : 0);
          			}
  
        			html += ' style="background-image:url(images/TreeControl/' + img + '); background-position:-' + (i*18) + 'px 0px;"';
        		}
      		
      		html += "></div>";
      		
      		return html;
      	},
    	
    	/*
    	Property: toggle
    		By default (with no arguments) this function toggles the node between expanded/collapsed.
    		Can also be used to recursively expand/collapse all or part of the tree.
    	
    	Parameters:
    		recursive - boolean, defaults to false. With recursive set to true, all child nodes are recursively toggle to this node's new state.
    		state - boolean. If undefined, the node's state is toggled. If true or false, the node can be explicitly opened or closed.
    	*/
    	
    	toggle: function(recursive, state) 
      	{
      		this.open = (state === undefined ? !this.open : state);

      		this.update();
      
      		this.onExpand(this.open);
      		this.control.onExpand(this, this.open);
      
      		if(recursive) 
      		  {
      		    this.nodes.forEach(function(node) {
      			    node.toggle(true, this.open);
      		    }, this);
      		  }
      	},
    	
    	/*
    	Property: select
    		Called by <MooTreeControl> when the selection changes.
    		You should not manually call this method - to set the selection, use the <MooTreeControl.select> method.
    	*/
    	
    	select: function(state) 
      	{
      		this.selected = state;
      		this.update();
      		this.onSelect(state);
      	},
      	
      /**
       * On every change of tree state (toggle of folder) need to update
       * the context menu... searches for and attaches to menu-able elements.
       *
       * @see #load
       * @see ContextMenu.js
       */
      refreshContextMenu: function()
        {
          /**
           * Refresh context menus.
           */
          if(contextMenu === true)
            {
          		/**
            	 * Every reload of the tree requires a "reload" of the context
            	 * menu, binding the new elements.
            	 */

              new ContextMenu({
              	targets: '.TreeControl_text',
              	menu: 'contextmenu',
              	
              	/**
              	 * The actions are each receiving two arguments, related to the DOM element
              	 * that the context menu is bound to.
              	 * @param   {Object}    e   DOM element reference.
              	 * @param   {Object}    r   All node info, including the information attached
              	 *                          to the node via #TreeControl.
              	 */
              	actions: {
              		'delete': function(e,r) {
              		  controller.unlink($AXIS.Editor.resourceById(e.id).url, e.type, e, r);
              		},
              		'rename': function(e,r) {
              		  controller.rename($AXIS.Editor.resourceById(e.id).url, e.type, e, r);
              		},
              		'duplicate': function(e,r) {
              		  controller.duplicate($AXIS.Editor.resourceById(e.id).url, e.type, e, r);
              		},
              		'cut': function(e,r) {
              		  controller.cut($AXIS.Editor.resourceById(e.id).url, e.type, e, r);
              		},
              		'copy': function(e,r) {
              		  controller.copy($AXIS.Editor.resourceById(e.id).url, e.type, e, r);
              		},
              		'paste': function(e,r) {
              		  controller.paste($AXIS.Editor.resourceById(e.id).url, e.type, e, r);
              		},
              		'trash': function(e,r) {
              		  controller.trash($AXIS.Editor.resourceById(e.id).url, e.type, e, r);
              		},
              		'empty': function(e,r) {
              		  controller.empty($AXIS.Editor.resourceById(e.id).url, e.type, e, r);
              		},
              		'restore': function(e,r) {
              		  controller.restore($AXIS.Editor.resourceById(e.id).url, e.type, e, r);
              		},
              		'refresh': function(e,r) {
              		  controller.refresh($AXIS.Editor.resourceById(e.id).url, e.type, e, r);
              		},
              		'folder_new': function(e,r) {
              		  controller.createFolder($AXIS.Editor.resourceById(e.id).url, e.type, e, r);
              		},
              		'file_new': function(e,r) {
              		  controller.createFile($AXIS.Editor.resourceById(e.id).url, e.type, e, r);
              		},
              		'upload': function(e,r) {
              		  controller.upload($AXIS.Editor.resourceById(e.id).url, e.type, e, r);
              		}    		    		
              	}
              });
            }
        },
    	
    	/*
    
    	
    	Parameters:
    		url - string, required, specifies the URL from which to load the XML document.
    		ops - query string, optional.
    	*/
    	
    	load: function(url, cmp) {
        /**
         * Allows the passing of a callback to fire once the node is loaded.
         * See onSuccess handler, below.
         */
        var loadCallback = AXIS.isFunction(cmp) ? cmp : AXIS.F;
        
    		if(this.loading) 
    		  {
    		    return; // if this node is already loading, return
    		  }

    		this.loading = true;      // flag this node as loading
    		this.toggle(false, true); // expand the node to make the loader visible
    		this.clear();

    		this.insert(this.control.loader);
    
        /**
         * The #readFolder method returns an object whose #folder attribute contains
         * a reference to a converted PROPFIND depth 1 on a url (arg `url`), which 
         * is passed to #_loaded.
         */
        AXIS.WebDAV.readFolder({
          url:        url,
          asynch:     $AXIS.Editor.FileTree.isAsynch,
          withCups:   true,
          scope:      this,
          onSuccess:   function(r) {
            
            /**
             * If there are no children this indicates either that a non-collection
             * was passed as url, or there simply aren't any childnodes in this
             * collection.  If the latter, we create an empty child object, which ensures 
             * that the tree instance exists, should we add to it dynamically (such as in
             * the case of the user creating a new file/folder in the collection).  If 
             * not a collection, make an attempt to find a collection.  We do this by
             * assuming that the previous path fragment is a collection url, and use 
             * the hash watcher set in init.js to handle loading the containing collection.
             * See init.js file, onHashChange callback.
             *
             * NOTE: that we allow the function to continue as normal after change.
             */
            if(r.folder.children.length < 1)
              {
                if(r.folder.type === 'file')
                  {
                    AXIS.History.set({
                      args:     { 
                        'loadColl': r.url.substring(0,r.url.lastIndexOf('/'))
                      }
                    });
                  }
                
                r.folder.children = {}; 
              }

            this._loaded(r.folder);
            
            /**
             * Note closure, above.
             */
            loadCallback(this);

            /**
             * Enable tooltips. Note that on the first call we actually load the
             * tooltips module. Afterwards, we just init (#set).
             */
            if(fileTips === true)
              {
                if(AXIS.isUndefined($AXIS.Modules.local.Tooltips))
                  {
                    AXIS.onDOMReady.subscribe({
                      callback: function() {
                        AXIS.Modules.load({
                          provider: 'local',
                          module:   'Tooltips',
                          options:  {
                            maxWidth: 400  
                          },
                          onload: function(r) {
                            $AXIS.Modules.local.Tooltips.set(); 
                          }
                        });  
                      }
                    });
                  }
                else
                  {
                    $AXIS.Modules.local.Tooltips.set()
                  }
              }
            
            this.refreshContextMenu();
          },
          onFailure: function(r) {
            /**
             * The only failure condition that should fire this handler is
             * the absence of a /trash folder in a logged-in user's /home
             * folder.  So we check if this is in fact the case, and if so
             * create the trash folder and reload.
             */
            var u = r.origRequestUrl;
            if(u.substring(u.length-6,u.length) === '/trash')
              {
                controller.createTrash();

                this.loading = false;
                this.load(treeUrl);
              }
          }
        });
    	},
    
    	_loaded: function(j) {
    	  
    	  /**
    	   * Convert data, mainly want to make sure that we add formatting options, by
    	   * adding class attributes (etc), which can then be passed to the renderer
    	   * (this.insert)
    	   */
    
    	  var cnodes =        j.children;

    	  /**
    	   * Set the resource info for root elements.
    	   */
    	  $AXIS.Editor.setResourceInfo(rootId, {
    	    url:  treeUrl,
    	    ob:   j
    	  });

    	  /**
    	   * This is simply the #href that the PROPFIND was run against,
    	   * which we need to use below for determining paths, etc.
    	   */
    	  var pNodePath =     j.href == '/' ? j.href : j.href + '/';

    	  var folderList =    [];
    	  var fileList =      [];
    	  var cP, fOb, hrs, cRef, resP, curPath, s1;
    	  
    	  var cPath = $AXIS.Editor.userHomeUrl + '/clipboard';
    	  var tPath = $AXIS.Editor.userHomeUrl + '/trash';
    	  
    	  for(var c=0; c < cnodes.length; c++)
    	    {
    	      fOb   = {};
    	      cP    = cnodes[c];
    	      resP  = cP.properties;
    	      cRef  = cP.href;

    	      /**
    	       * It is likely that the user will have a /clipboard folder, but
    	       * this is hidden to the view.
    	       */
    	      if(cRef.substring(0,cPath.length) === cPath && (cRef.length === cPath.length))
    	        {
    	          continue;  
    	        }
    	        
    	      /**
    	       * It is likely that the user will have a /trash folder, but
    	       * this is hidden to the view.
    	       */
    	      if(cRef.substring(0,tPath.length) === tPath && (cRef.length === tPath.length))
    	        {
    	          continue;  
    	        }
    	        
    	      /**
    	       * Hide certain file types (hidden files).
    	       */
    	      if(new RegExp('^(' + hiddenFiles.join('|') + ')$').test(cRef.substring(cRef.lastIndexOf('.') +1, cRef.length)))
    	        {
    	          continue;  
    	        }

            /**
             * Get the resource href, and set the #text property of the
             * node object, which is used as the label for a resource 
             * in the tree view.
             */
    	      hrs = cRef.split('/');
    	      fOb.text = hrs[hrs.length-1].substring(0,hrs[hrs.length-1].length);
    	      
    	      /**
    	       * One of `collection` or `file`.  Used when determining if
    	       * a folder(collection) or file(file).
    	       */
    	      fOb.type          = cP.type;
    
    	      curPath           = pNodePath + fOb.text;
    	      
    	      fOb.parentId      = pNodePath;
    	      
    	      /**
    	       * Store resource info, keyed by id.
    	       */
    	      s1 = $AXIS.Editor.getId(curPath);
    	      
    	      /**
    	       * Set resource info for all non-root resources.
    	       */
    	      $AXIS.Editor.setResourceInfo(s1, {
    	        url:  curPath,
    	        ob:   cP
    	      });
    	      
    	      fOb.id            = s1;

    	      if(cP.type == 'collection')
    	        {
    	          fOb.icon =  '_closed';
    	          fOb.load =  curPath;
    	          fOb.type = 'collection';
    
    	          folderList.push(fOb);
    	        }
    	      else
    	        {
    	          fOb.icon = '_doc';
    	          fOb.type = 'file';
    	          
    	          /**
    	           * Properties of the resource object
    	           */
    	          fOb.getlastmodified   = resP.getlastmodified  || false;
    	          fOb.creationdate      = resP.creationdate     || false;
    	          fOb.getcontentlength  = resP.getcontentlength || false;         
    	          
    	          fileList.push(fOb);
    	        } 
    	    }
    
    		// called on success - import nodes from the root element:
    		this.control.disable();
    		this.clear();
    		this._import(folderList.concat(fileList));
    		this.control.enable();
    		this.loading = false;

        return this;
    	},
    
    	_import: function(json) 
      	{
          var tt = '';
          var node;
          
      		for(var i=0; i<json.length; i++) 
        		{
        			var opt = {data:{}};
        			var a = json[i];
        			
        			/**
        			 * These set data on a node, ie. node.data.key
        			 */
        			for(var t in a) 
          			{
          				switch(t) 
            				{
            					case 'text':
            					case 'id':
            					case 'icon':
            					case 'openicon':
            					case 'color':
            					case 'open':
            						opt[t] = a[t];
            					break;
            					
            					default:
            						opt.data[t] = a[t];
            				  break;
            				}
          			}
        			
        			node = this.insert(opt);
        
              /** 
               * Add file info tooltip info for files, if requested.
               */
              if(fileTips && a.type === 'file')
                {
                  tt = '<table>';
                  tt += '<tr><td>Last Modified:</td><td>' + (a.getlastmodified || 'NA') + '</td></tr>';
                  tt += '<tr><td>Created On:</td><td>' + (a.creationdate || 'NA') + '</td></tr>';
                  tt += '<tr><td>Length:</td><td>' + (a.getcontentlength || 'NA') + '</td></tr>';
                  tt += '</table>';
        
                  node.div.text.addClass('AXIS_tooltip');
                  node.div.text.set('tip',tt);
                }
                
        			if(node.data.load) 
          			{
          				node.open = false; // can't have a dynamically loading node that's already open!
          				node.insert(this.control.loader);
          				node.onExpand = function(state) 
            				{
            					this.load(this.data.load);
            					this.onExpand = AXIS.F;
            				}
          			}
        		}
      	},
    	
    	_load_err: function(req) {
    		window.alert('Error loading: ' + this.text);
    	}
    	
    });













    /**************************************
     * 
     * Build return object
     *
     **************************************/

    /**
     * Create the tree control, and extend it.
     */
    
    var ret = new MooTreeControl({
      div:    DomContainerId,
    	mode:   mode,
    	grid:   grid,
    	
    	onClick: function(node) 
      	{
      	  this.changeCurrentFile(node);
        },
      
      onExpand: function(node, state) 
        {
          /**
           * Keep list of open folders. Delete if state === false.
           */
          var OF = $AXIS.Editor.openFolders;          
          OF[node.id] = OF[node.id] || node;
          if(state === false)
            {
              delete OF[node.id];  
            }
        }
      
    },{});
        
    /**
     * Fired whenever a user clicks on a filename.
     *
     * @see #onclick definition for this object.
     */
    ret.changeCurrentFile = function(node)
      {
        var res  = $AXIS.Editor.resourceById(node.id);
        var nUrl = res.url;

        if(!!nUrl === false)
          {
            MochaUI.notification('Please select a file.');
            return;
          }

        /**
         * If already open in editor, don't reload, just switch tab.
         */
        if(res.openInEditor)
          {
            $AXIS.Editor.switchTab(nUrl);
            
            return;  
          }
          
        /**
         * Only load individual files, not collections.
         */
        if(node.data.type === 'collection')
          {
            return;  
          }

        $AXIS.Editor.updateFileHash(nUrl);
      };
    
    ret.load = function(cb) 
      {  
        /**
         * This information is picked up and used by #MooTreeNode
         */
        this.root.id    = rootId;
        this.root.text  = rootLabel;

        this.root.load(treeUrl, cb);  
      };

    return ret;
  };
  
